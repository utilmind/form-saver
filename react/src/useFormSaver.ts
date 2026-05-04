import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'

import {
    isStorageAvailable as checkStorageAvailable,
    readStoredForm,
    removeStoredForm,
    writeStoredForm
} from './storage'
import type {
    FormSaverFieldName,
    FormSaverValue,
    FormSaverValuesConstraint,
    UseFormSaverBinders,
    UseFormSaverOptions,
    UseFormSaverResult
} from './types'

// Converts persisted primitive values to a controlled input string.
function valueToInputString(value: FormSaverValue | undefined): string {
    return value === null || value === undefined || Array.isArray(value) ? '' : String(value)
}

function valueToSelectValue(
    value: FormSaverValue | undefined
): string | number | readonly string[] {
    if (Array.isArray(value)) {
        return value.map(function (item) {
            return String(item)
        })
    }

    if (typeof value === 'number') {
        return value
    }

    if (value === null || value === undefined) {
        return ''
    }

    return String(value)
}

// Stores the latest callback/value without making effects depend on its identity.
function useLatestRef<TValue>(value: TValue): { current: TValue } {
    const ref = useRef(value)

    ref.current = value
    return ref
}

// Merges a patch into state but keeps the same object reference when nothing changed.
function mergeValuesIfChanged<TValues extends FormSaverValuesConstraint<TValues>>(
    current: TValues,
    patch: Partial<TValues>
): TValues {
    let nextValues: TValues | null = null
    let key: keyof TValues

    for (key in patch) {
        if (
            Object.prototype.hasOwnProperty.call(patch, key) &&
            !Object.is(current[key], patch[key])
        ) {
            if (!nextValues) {
                nextValues = { ...current }
            }

            nextValues[key] = patch[key] as TValues[keyof TValues]
        }
    }

    return nextValues || current
}

// Reads all selected option values from a native multi-select element.
function getMultiSelectValues(select: HTMLSelectElement): string[] {
    const values: string[] = []

    for (let i = 0; i < select.selectedOptions.length; ++i) {
        values.push(select.selectedOptions[i].value)
    }

    return values
}

// Keeps React state limited to known fields unless the caller explicitly opts into unknown keys.
function pickKnownValues<TValues extends FormSaverValuesConstraint<TValues>>(
    values: Partial<TValues>,
    initialValues: TValues,
    restoreUnknownKeys: boolean
): Partial<TValues> {
    var result: Partial<TValues> = restoreUnknownKeys ? { ...values } : {}
    var key: keyof TValues

    if (restoreUnknownKeys) {
        return result
    }

    for (key in initialValues) {
        if (Object.prototype.hasOwnProperty.call(initialValues, key) && values[key] !== undefined) {
            result[key] = values[key]
        }
    }

    return result
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
        onError
    } = options

    var initialValuesRef = useRef(initialValues)
    var skipNextSaveRef = useRef(!saveOnMount)
    var [values, setValuesState] = useState<TValues>(initialValues)
    var [hasRestored, setHasRestored] = useState(false)
    var [restoredAt, setRestoredAt] = useState<number | undefined>()
    var [lastSavedAt, setLastSavedAt] = useState<number | undefined>()
    var [isStorageAvailable, setIsStorageAvailable] = useState(false)
    var mapBeforeSaveRef = useLatestRef(mapBeforeSave)
    var mapAfterLoadRef = useLatestRef(mapAfterLoad)
    var onRestoreRef = useLatestRef(onRestore)
    var onSaveRef = useLatestRef(onSave)
    var onErrorRef = useLatestRef(onError)

    // Keep the latest initial values available for reset without forcing rehydration.
    useEffect(
        function () {
            initialValuesRef.current = initialValues
        },
        [initialValues]
    )

    // Keep the skip flag in sync when the storage target changes.
    useEffect(
        function () {
            skipNextSaveRef.current = !saveOnMount
        },
        [saveOnMount, storageKey, storage]
    )

    // Restore after mount so Next.js server rendering never touches browser storage.
    useEffect(
        function () {
            var stored
            var loadedValues: Partial<TValues> | null | undefined
            var knownValues: Partial<TValues>

            if (!enabled) {
                setHasRestored(true)
                return
            }

            try {
                setIsStorageAvailable(checkStorageAvailable(storage))
                stored = readStoredForm<TValues>(storageKey, { storage: storage })

                if (stored) {
                    loadedValues = mapAfterLoadRef.current
                        ? mapAfterLoadRef.current(stored.values, stored.meta)
                        : stored.values

                    if (loadedValues) {
                        knownValues = pickKnownValues<TValues>(
                            loadedValues,
                            initialValuesRef.current,
                            restoreUnknownKeys
                        )
                        setValuesState(function (current: TValues) {
                            return mergeValuesIfChanged<TValues>(current, knownValues)
                        })
                        setRestoredAt(stored.meta.savedAt)
                        if (onRestoreRef.current) {
                            onRestoreRef.current(knownValues, stored.meta)
                        }
                    }
                }
            } catch (error) {
                if (onErrorRef.current) {
                    onErrorRef.current(error)
                }
            } finally {
                setHasRestored(true)
            }
        },
        [enabled, restoreUnknownKeys, storage, storageKey]
    )

    // Save the current controlled state to browser storage.
    var saveValues = useCallback(
        function (nextValues: TValues): void {
            var saved

            if (!enabled || !storageKey) {
                return
            }

            try {
                saved = writeStoredForm<TValues>(storageKey, nextValues, {
                    storage: storage,
                    version: version,
                    mergeUnknownKeys: mergeUnknownKeys,
                    mapBeforeSave: mapBeforeSaveRef.current
                })

                if (saved) {
                    setLastSavedAt(saved.meta.savedAt)
                    setIsStorageAvailable(true)
                    if (onSaveRef.current) {
                        onSaveRef.current(saved.values, saved.meta)
                    }
                }
            } catch (error) {
                setIsStorageAvailable(false)
                if (onErrorRef.current) {
                    onErrorRef.current(error)
                }
            }
        },
        [enabled, mergeUnknownKeys, storage, storageKey, version]
    )

    // Persist value changes after restore is complete.
    useEffect(
        function () {
            var timerId: ReturnType<typeof setTimeout>

            if (!enabled || !hasRestored) {
                return
            }

            if (skipNextSaveRef.current) {
                skipNextSaveRef.current = false
                return
            }

            if (debounceMs <= 0) {
                saveValues(values)
                return
            }

            timerId = setTimeout(function () {
                saveValues(values)
            }, debounceMs)

            return function () {
                clearTimeout(timerId)
            }
        },
        [debounceMs, enabled, hasRestored, saveValues, values]
    )

    var setValue = useCallback(function <K extends FormSaverFieldName<TValues>>(
        name: K,
        value: TValues[K]
    ): void {
        setValuesState(function (current: TValues) {
            var patch = {} as Partial<TValues>

            patch[name] = value
            return mergeValuesIfChanged<TValues>(current, patch)
        })
    }, [])

    var setValues = useCallback(function (
        patch: Partial<TValues> | ((current: TValues) => Partial<TValues>)
    ): void {
        setValuesState(function (current: TValues) {
            var resolvedPatch = typeof patch === 'function' ? patch(current) : patch

            return mergeValuesIfChanged<TValues>(current, resolvedPatch)
        })
    }, [])

    var replaceValues = useCallback(function (nextValues: TValues): void {
        setValuesState(nextValues)
    }, [])

    var resetValues = useCallback(function (nextValues?: TValues): void {
        setValuesState(nextValues || initialValuesRef.current)
    }, [])

    var clearStoredValues = useCallback(
        function (): void {
            try {
                removeStoredForm(storageKey, storage)
                setLastSavedAt(undefined)
            } catch (error) {
                if (onErrorRef.current) {
                    onErrorRef.current(error)
                }
            }
        },
        [storage, storageKey]
    )

    var saveNow = useCallback(
        function (): void {
            saveValues(values)
        },
        [saveValues, values]
    )

    // Convenience binders for common controlled form controls.
    var bind = useMemo<UseFormSaverBinders<TValues>>(
        function () {
            return {
                text: function <K extends FormSaverFieldName<TValues>>(name: K) {
                    return {
                        name: name,
                        value: valueToInputString(values[name]),
                        onChange: function (event: React.ChangeEvent<HTMLInputElement>) {
                            setValue(name, event.target.value as TValues[K])
                        }
                    }
                },

                textarea: function <K extends FormSaverFieldName<TValues>>(name: K) {
                    return {
                        name: name,
                        value: valueToInputString(values[name]),
                        onChange: function (event: React.ChangeEvent<HTMLTextAreaElement>) {
                            setValue(name, event.target.value as TValues[K])
                        }
                    }
                },

                checkbox: function <K extends FormSaverFieldName<TValues>>(name: K) {
                    return {
                        name: name,
                        checked: Boolean(values[name]),
                        onChange: function (event: React.ChangeEvent<HTMLInputElement>) {
                            setValue(name, event.target.checked as TValues[K])
                        }
                    }
                },

                radio: function <K extends FormSaverFieldName<TValues>>(
                    name: K,
                    optionValue: NonNullable<TValues[K]>
                ) {
                    return {
                        name: name,
                        value: valueToSelectValue(optionValue as FormSaverValue),
                        checked: Object.is(values[name], optionValue),
                        onChange: function (event: React.ChangeEvent<HTMLInputElement>) {
                            if (event.target.checked) {
                                setValue(name, optionValue as TValues[K])
                            }
                        }
                    }
                },

                select: function <K extends FormSaverFieldName<TValues>>(name: K) {
                    return {
                        name: name,
                        value: valueToSelectValue(values[name]),
                        onChange: function (event: React.ChangeEvent<HTMLSelectElement>) {
                            setValue(name, event.target.value as TValues[K])
                        }
                    }
                },

                multiSelect: function <K extends FormSaverFieldName<TValues>>(name: K) {
                    return {
                        name: name,
                        multiple: true as const,
                        value: Array.isArray(values[name])
                            ? (values[name] as Array<string | number | boolean | null>).map(
                                  function (item) {
                                      return String(item)
                                  }
                              )
                            : [],
                        onChange: function (event: React.ChangeEvent<HTMLSelectElement>) {
                            setValue(name, getMultiSelectValues(event.target) as TValues[K])
                        }
                    }
                }
            }
        },
        [setValue, values]
    )

    return useMemo<UseFormSaverResult<TValues>>(
        function () {
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
                bind: bind
            }
        },
        [
            values,
            setValue,
            setValues,
            replaceValues,
            resetValues,
            clearStoredValues,
            saveNow,
            hasRestored,
            restoredAt,
            lastSavedAt,
            isStorageAvailable,
            bind
        ]
    )
}
