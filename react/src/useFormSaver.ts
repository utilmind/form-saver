import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';

import {
  isStorageAvailable as checkStorageAvailable,
  readStoredForm,
  removeStoredForm,
  writeStoredForm,
} from './storage';
import type {
  FormSaverFieldName,
  FormSaverValue,
  FormSaverValuesConstraint,
  UseFormSaverBinders,
  UseFormSaverOptions,
  UseFormSaverResult,
} from './types';

// Converts persisted primitive values to a controlled input string.
function valueToInputString(value: FormSaverValue | undefined): string {
  if (value === null || value === undefined || Array.isArray(value)) {
    return '';
  }

  return String(value);
}

function valueToSelectValue(value: FormSaverValue | undefined): string | number | readonly string[] {
  if (Array.isArray(value)) {
    return value.map(function (item) {
      return String(item);
    });
  }

  if (typeof value === 'number') {
    return value;
  }

  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}

// Reads all selected option values from a native multi-select element.
function getMultiSelectValues(select: HTMLSelectElement): string[] {
  var values: string[] = [];
  var i: number;

  for (i = 0; i < select.selectedOptions.length; i += 1) {
    values.push(select.selectedOptions[i].value);
  }

  return values;
}

// Keeps React state limited to known fields unless the caller explicitly opts into unknown keys.
function pickKnownValues<TValues extends FormSaverValuesConstraint<TValues>>(
  values: Partial<TValues>,
  initialValues: TValues,
  restoreUnknownKeys: boolean
): Partial<TValues> {
  var result: Partial<TValues> = restoreUnknownKeys ? { ...values } : {};
  var key: keyof TValues;

  if (restoreUnknownKeys) {
    return result;
  }

  for (key in initialValues) {
    if (Object.prototype.hasOwnProperty.call(initialValues, key) && values[key] !== undefined) {
      result[key] = values[key];
    }
  }

  return result;
}

export function useFormSaver<TValues extends FormSaverValuesConstraint<TValues>>(
  options: UseFormSaverOptions<TValues>
): UseFormSaverResult<TValues> {
  var {
    storageKey,
    initialValues,
    storage = 'localStorage',
    enabled = true,
    debounceMs = 150,
    saveOnMount = false,
    version,
    mergeUnknownKeys = true,
    restoreUnknownKeys = false,
    mapBeforeSave,
    mapAfterLoad,
    onRestore,
    onSave,
    onError,
  } = options;

  var initialValuesRef = useRef(initialValues);
  var skipNextSaveRef = useRef(!saveOnMount);
  var [values, setValuesState] = useState<TValues>(initialValues);
  var [hasRestored, setHasRestored] = useState(false);
  var [restoredAt, setRestoredAt] = useState<number | undefined>();
  var [lastSavedAt, setLastSavedAt] = useState<number | undefined>();
  var [isStorageAvailable, setIsStorageAvailable] = useState(false);

  // Keep the latest initial values available for reset without forcing rehydration.
  useEffect(function () {
    initialValuesRef.current = initialValues;
  }, [initialValues]);

  // Keep the skip flag in sync when the storage target changes.
  useEffect(function () {
    skipNextSaveRef.current = !saveOnMount;
  }, [saveOnMount, storageKey, storage]);

  // Restore after mount so Next.js server rendering never touches browser storage.
  useEffect(function () {
    var stored;
    var loadedValues: Partial<TValues> | null | undefined;
    var knownValues: Partial<TValues>;

    if (!enabled) {
      setHasRestored(true);
      return;
    }

    try {
      setIsStorageAvailable(checkStorageAvailable(storage));
      stored = readStoredForm<TValues>(storageKey, { storage: storage });

      if (stored) {
        loadedValues = mapAfterLoad ? mapAfterLoad(stored.values, stored.meta) : stored.values;

        if (loadedValues) {
          knownValues = pickKnownValues<TValues>(loadedValues, initialValuesRef.current, restoreUnknownKeys);
          setValuesState(function (current: TValues) {
            return {
              ...current,
              ...knownValues,
            };
          });
          setRestoredAt(stored.meta.savedAt);
          if (onRestore) {
            onRestore(knownValues, stored.meta);
          }
        }
      }
    } catch (error) {
      if (onError) {
        onError(error);
      }
    } finally {
      setHasRestored(true);
    }
  }, [enabled, mapAfterLoad, onError, onRestore, restoreUnknownKeys, storage, storageKey]);

  // Save the current controlled state to browser storage.
  var saveValues = useCallback(
    function (nextValues: TValues): void {
      var saved;

      if (!enabled || !storageKey) {
        return;
      }

      try {
        saved = writeStoredForm<TValues>(storageKey, nextValues, {
          storage: storage,
          version: version,
          mergeUnknownKeys: mergeUnknownKeys,
          mapBeforeSave: mapBeforeSave,
        });

        if (saved) {
          setLastSavedAt(saved.meta.savedAt);
          setIsStorageAvailable(true);
          if (onSave) {
            onSave(saved.values, saved.meta);
          }
        }
      } catch (error) {
        setIsStorageAvailable(false);
        if (onError) {
          onError(error);
        }
      }
    },
    [enabled, mergeUnknownKeys, mapBeforeSave, onError, onSave, storage, storageKey, version]
  );

  // Persist value changes after restore is complete.
  useEffect(
    function () {
      var timerId: ReturnType<typeof setTimeout>;

      if (!enabled || !hasRestored) {
        return;
      }

      if (skipNextSaveRef.current) {
        skipNextSaveRef.current = false;
        return;
      }

      if (debounceMs <= 0) {
        saveValues(values);
        return;
      }

      timerId = setTimeout(function () {
        saveValues(values);
      }, debounceMs);

      return function () {
        clearTimeout(timerId);
      };
    },
    [debounceMs, enabled, hasRestored, saveValues, values]
  );

  var setValue = useCallback(
    function <K extends FormSaverFieldName<TValues>>(name: K, value: TValues[K]): void {
      setValuesState(function (current: TValues) {
        return {
          ...current,
          [name]: value,
        };
      });
    },
    []
  );

  var setValues = useCallback(function (patch: Partial<TValues> | ((current: TValues) => Partial<TValues>)): void {
    setValuesState(function (current: TValues) {
      var resolvedPatch = typeof patch === 'function' ? patch(current) : patch;

      return {
        ...current,
        ...resolvedPatch,
      };
    });
  }, []);

  var replaceValues = useCallback(function (nextValues: TValues): void {
    setValuesState(nextValues);
  }, []);

  var resetValues = useCallback(function (nextValues?: TValues): void {
    setValuesState(nextValues || initialValuesRef.current);
  }, []);

  var clearStoredValues = useCallback(function (): void {
    try {
      removeStoredForm(storageKey, storage);
      setLastSavedAt(undefined);
    } catch (error) {
      if (onError) {
        onError(error);
      }
    }
  }, [onError, storage, storageKey]);

  var saveNow = useCallback(function (): void {
    saveValues(values);
  }, [saveValues, values]);

  // Convenience binders for common controlled form controls.
  var bind = useMemo<UseFormSaverBinders<TValues>>(
    function () {
      return {
        text: function <K extends FormSaverFieldName<TValues>>(name: K) {
          return {
            name: name,
            value: valueToInputString(values[name]),
            onChange: function (event: React.ChangeEvent<HTMLInputElement>) {
              setValue(name, event.target.value as TValues[K]);
            },
          };
        },

        textarea: function <K extends FormSaverFieldName<TValues>>(name: K) {
          return {
            name: name,
            value: valueToInputString(values[name]),
            onChange: function (event: React.ChangeEvent<HTMLTextAreaElement>) {
              setValue(name, event.target.value as TValues[K]);
            },
          };
        },

        checkbox: function <K extends FormSaverFieldName<TValues>>(name: K) {
          return {
            name: name,
            checked: Boolean(values[name]),
            onChange: function (event: React.ChangeEvent<HTMLInputElement>) {
              setValue(name, event.target.checked as TValues[K]);
            },
          };
        },

        radio: function <K extends FormSaverFieldName<TValues>>(name: K, optionValue: NonNullable<TValues[K]>) {
          return {
            name: name,
            value: valueToSelectValue(optionValue as FormSaverValue),
            checked: Object.is(values[name], optionValue),
            onChange: function (event: React.ChangeEvent<HTMLInputElement>) {
              if (event.target.checked) {
                setValue(name, optionValue as TValues[K]);
              }
            },
          };
        },

        select: function <K extends FormSaverFieldName<TValues>>(name: K) {
          return {
            name: name,
            value: valueToSelectValue(values[name]),
            onChange: function (event: React.ChangeEvent<HTMLSelectElement>) {
              setValue(name, event.target.value as TValues[K]);
            },
          };
        },

        multiSelect: function <K extends FormSaverFieldName<TValues>>(name: K) {
          return {
            name: name,
            multiple: true as const,
            value: Array.isArray(values[name])
              ? (values[name] as Array<string | number | boolean | null>).map(function (item) {
                  return String(item);
                })
              : [],
            onChange: function (event: React.ChangeEvent<HTMLSelectElement>) {
              setValue(name, getMultiSelectValues(event.target) as TValues[K]);
            },
          };
        },
      };
    },
    [setValue, values]
  );

  return {
    values: values,
    setValue: setValue,
    setValues: setValues,
    replaceValues: replaceValues,
    resetValues: resetValues,
    clearStoredValues: clearStoredValues,
    saveNow: saveNow,
    hasRestored: hasRestored,
    restoredAt: restoredAt,
    lastSavedAt: lastSavedAt,
    isStorageAvailable: isStorageAvailable,
    bind: bind,
  };
}
