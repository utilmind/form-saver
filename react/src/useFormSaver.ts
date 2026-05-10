/**
 * Main React hook implementation for persisted controlled form state.
 *
 * useFormSaver restores saved values from browser storage after mount, exposes a
 * typed set of native input binders, and writes changes back with optional
 * debouncing. The hook is designed to be safe for server rendering by avoiding
 * browser storage access during render.
 *
 * Developer notes:
 * - Keep storage access inside effects or explicit callbacks, never during SSR.
 * - Ref wrappers are used so callback options stay current without forcing
 *   restore/save effects to rerun on every render.
 * - Changes to binder behavior should be checked against the demo and tests.
 */

import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { readStoredForm, removeStoredForm, writeStoredForm } from './storage'
import type {
    FormSaverFieldName,
    FormSaverValue,
    FormSaverValuesConstraint,
    UseFormSaverBinders,
    UseFormSaverOptions,
    UseFormSaverResult
} from './types'

// Converts persisted primitive values to a controlled input string.
const valueToInputString = (value: FormSaverValue | undefined): string =>
    value === null || value === undefined || Array.isArray(value) ? '' : String(value)

const valueToSelectValue = (
    value: FormSaverValue | undefined
): string | number | readonly string[] => {
    if (Array.isArray(value)) {
        return value.map((item) => String(item))
    }

    if (typeof value === 'number') {
        return value
    }

    return value === null || value === undefined ? '' : String(value)
}

const valueToMultiSelectValue = (value: FormSaverValue | undefined): readonly string[] =>
    Array.isArray(value) ? value.map((item) => String(item)) : []

// Stores the latest callback/value without making effects depend on its identity.
type LatestRef<TValue> = {
    current: TValue
}

const useLatestRef = <TValue>(value: TValue): LatestRef<TValue> => {
    const ref = useRef(value)

    ref.current = value
    return ref
}

// Merges a patch into state but keeps the same object reference when nothing changed.
const mergeValuesIfChanged = <TValues extends FormSaverValuesConstraint<TValues>>(
    current: TValues,
    patch: Partial<TValues>
): TValues => {
    let nextValues: TValues | null = null

    for (const key in patch) {
        const val = patch[key]
        if (!Object.is(current[key], val)) {
            if (!nextValues) {
                nextValues = {} as TValues
                // Manual copy instead of spread
                for (const k in current) {
                    nextValues[k] = current[k]
                }
            }
            nextValues[key] = val as TValues[typeof key]
        }
    }

    return nextValues ?? current
}

// Reads all selected option values from a native multi-select element.
const getMultiSelectValues = (select: HTMLSelectElement): string[] =>
    Array.from(select.selectedOptions, (option) => option.value)

// Keeps React state limited to known fields unless the caller explicitly opts into unknown keys.
const pickKnownValues = <TValues extends FormSaverValuesConstraint<TValues>>(
    values: Partial<TValues>,
    initialValues: TValues,
    restoreUnknownKeys: boolean
): Partial<TValues> => {
    const result: Partial<TValues> = {}

    if (restoreUnknownKeys) {
        // Avoid { ...values } to skip extra allocation in some engines
        for (const key in values) {
            result[key] = values[key]
        }
        return result
    }

    // Only pick keys that exist in initialValues
    for (const key in initialValues) {
        const val = values[key]
        if (val !== undefined) {
            result[key] = val
        }
    }

    return result
}

export const useFormSaver = <TValues extends FormSaverValuesConstraint<TValues>>(
    options: UseFormSaverOptions<TValues>
): UseFormSaverResult<TValues> => {
    const {
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

    const initialValuesRef = useRef(initialValues)
    const skipNextSaveRef = useRef(!saveOnMount)
    const [values, setValuesState] = useState<TValues>(initialValues)
    const [hasRestored, setHasRestored] = useState(false)
    const [restoredAt, setRestoredAt] = useState<number | undefined>()
    const [lastSavedAt, setLastSavedAt] = useState<number | undefined>()
    const mapBeforeSaveRef = useLatestRef(mapBeforeSave)
    const mapAfterLoadRef = useLatestRef(mapAfterLoad)
    const onRestoreRef = useLatestRef(onRestore)
    const onSaveRef = useLatestRef(onSave)
    const onErrorRef = useLatestRef(onError)

    // Keep the latest initial values available for reset without forcing rehydration.
    useEffect(() => {
        initialValuesRef.current = initialValues
    }, [initialValues])

    // Keep the skip flag in sync when the storage target changes.
    useEffect(() => {
        skipNextSaveRef.current = !saveOnMount
    }, [saveOnMount, storage, storageKey])

    // Restore after mount so Next.js server rendering never touches browser storage.
    useEffect(() => {
        if (!enabled) {
            setHasRestored(true)
            return
        }

        try {
            const stored = readStoredForm<TValues>(storageKey, { storage })
            if (!stored) {
                return
            }

            const loadedValues = mapAfterLoadRef.current
                ? mapAfterLoadRef.current(stored.values, stored.meta)
                : stored.values
            if (!loadedValues) {
                return
            }

            const knownValues = pickKnownValues<TValues>(
                loadedValues,
                initialValuesRef.current,
                restoreUnknownKeys
            )

            setValuesState((current) => mergeValuesIfChanged<TValues>(current, knownValues))
            setRestoredAt(stored.meta.savedAt)
            onRestoreRef.current?.(knownValues, stored.meta)
        } catch (error) {
            onErrorRef.current?.(error)
        } finally {
            setHasRestored(true)
        }
    }, [
        enabled,
        mapAfterLoadRef,
        onErrorRef,
        onRestoreRef,
        restoreUnknownKeys,
        storage,
        storageKey
    ])

    // Save the current controlled state to browser storage.
    const saveValues = useCallback(
        (nextValues: TValues): void => {
            if (!enabled || !storageKey) {
                return
            }

            try {
                const saved = writeStoredForm<TValues>(storageKey, nextValues, {
                    storage,
                    version,
                    mergeUnknownKeys,
                    mapBeforeSave: mapBeforeSaveRef.current
                })

                if (saved) {
                    setLastSavedAt(saved.meta.savedAt)
                    onSaveRef.current?.(saved.values, saved.meta)
                }
            } catch (error) {
                onErrorRef.current?.(error)
            }
        },
        [
            enabled,
            mapBeforeSaveRef,
            mergeUnknownKeys,
            onErrorRef,
            onSaveRef,
            storage,
            storageKey,
            version
        ]
    )

    // Persist value changes after restore is complete.
    useEffect(() => {
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

        const timerId = setTimeout(() => {
            saveValues(values)
        }, debounceMs)

        return () => {
            clearTimeout(timerId)
        }
    }, [debounceMs, enabled, hasRestored, saveValues, values])

    const setValue = useCallback(
        <K extends FormSaverFieldName<TValues>>(name: K, value: TValues[K]): void => {
            setValuesState((current) => {
                const patch: Partial<TValues> = {}

                patch[name] = value
                return mergeValuesIfChanged<TValues>(current, patch)
            })
        },
        []
    )

    const setValues = useCallback(
        (patch: Partial<TValues> | ((current: TValues) => Partial<TValues>)): void => {
            setValuesState((current) => {
                const resolvedPatch = typeof patch === 'function' ? patch(current) : patch

                return mergeValuesIfChanged<TValues>(current, resolvedPatch)
            })
        },
        []
    )

    const replaceValues = useCallback((nextValues: TValues): void => {
        setValuesState(nextValues)
    }, [])

    const resetValues = useCallback((nextValues?: TValues): void => {
        setValuesState(nextValues ?? initialValuesRef.current)
    }, [])

    const clearStoredValues = useCallback((): void => {
        try {
            removeStoredForm(storageKey, storage)
            setLastSavedAt(undefined)
        } catch (error) {
            onErrorRef.current?.(error)
        }
    }, [onErrorRef, storage, storageKey])

    const saveNow = useCallback((): void => {
        saveValues(values)
    }, [saveValues, values])

    // Convenience binders for common controlled form controls.
    const bind = useMemo<UseFormSaverBinders<TValues>>(
        () => ({
            text: <K extends FormSaverFieldName<TValues>>(name: K) => ({
                name,
                value: valueToInputString(values[name]),
                onChange: (event: ChangeEvent<HTMLInputElement>) => {
                    setValue(name, event.target.value as TValues[K])
                }
            }),

            textarea: <K extends FormSaverFieldName<TValues>>(name: K) => ({
                name,
                value: valueToInputString(values[name]),
                onChange: (event: ChangeEvent<HTMLTextAreaElement>) => {
                    setValue(name, event.target.value as TValues[K])
                }
            }),

            checkbox: <K extends FormSaverFieldName<TValues>>(name: K) => ({
                name,
                checked: Boolean(values[name]),
                onChange: (event: ChangeEvent<HTMLInputElement>) => {
                    setValue(name, event.target.checked as TValues[K])
                }
            }),

            radio: <K extends FormSaverFieldName<TValues>>(
                name: K,
                optionValue: NonNullable<TValues[K]>
            ) => ({
                name,
                value: valueToSelectValue(optionValue),
                checked: Object.is(values[name], optionValue),
                onChange: (event: ChangeEvent<HTMLInputElement>) => {
                    if (event.target.checked) {
                        setValue(name, optionValue)
                    }
                }
            }),

            select: <K extends FormSaverFieldName<TValues>>(name: K) => ({
                name,
                value: valueToSelectValue(values[name]),
                onChange: (event: ChangeEvent<HTMLSelectElement>) => {
                    setValue(name, event.target.value as TValues[K])
                }
            }),

            multiSelect: <K extends FormSaverFieldName<TValues>>(name: K) => ({
                name,
                multiple: true,
                value: valueToMultiSelectValue(values[name]),
                onChange: (event: ChangeEvent<HTMLSelectElement>) => {
                    setValue(name, getMultiSelectValues(event.target) as TValues[K])
                }
            })
        }),
        [setValue, values]
    )

    return useMemo<UseFormSaverResult<TValues>>(
        () => ({
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
            bind
        }),
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
            bind
        ]
    )
}
