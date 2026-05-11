/**
 * DOM-based React hook for persisted uncontrolled native form controls.
 *
 * This API is intentionally closer to the legacy jQuery plugin: attach a ref to
 * a form or container, and FormSaver will collect/restore named native controls
 * inside that scope. It is best for uncontrolled inputs. For controlled React
 * state, keep using useFormSaver.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
    collectDomFormValues,
    type DomControlOptions,
    resetDomFormValues,
    restoreDomFormValues
} from './domControls'
import { readStoredForm, removeStoredForm, writeStoredForm } from './storage'
import type {
    FormSaverValues,
    StoredFormSaverData,
    UseFormSaverDomOptions,
    UseFormSaverDomResult
} from './types'

type LatestRef<TValue> = {
    current: TValue
}

const useLatestRef = <TValue>(value: TValue): LatestRef<TValue> => {
    const ref = useRef(value)

    ref.current = value
    return ref
}

const clearTimer = (timerRef: LatestRef<ReturnType<typeof setTimeout> | null>): void => {
    if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
    }
}

const shouldSaveAfterDomEvent = (event: Event): boolean => {
    const target = event.target

    if (event.type !== 'input') {
        return true
    }

    // Avoid duplicate saves. Checkbox/radio/select changes are handled by the
    // change event; text-like inputs and textarea are handled by the input event.
    if (target instanceof HTMLInputElement) {
        const type = target.type.toLowerCase()
        return type !== 'checkbox' && type !== 'radio'
    }

    return !(target instanceof HTMLSelectElement)
}

// Hook
export const useFormSaverDom = <TRoot extends HTMLElement = HTMLElement>(
    options: UseFormSaverDomOptions
): UseFormSaverDomResult<TRoot> => {
    const {
        storageKey,
        storage = 'localStorage', // 'localStorage' or 'sessionStorage'
        enabled = true,
        debounceMs = 150, // ms
        saveEvent = 'change', // 'change' or 'input'
        restoreOnMount = true,
        version,
        mergeUnknownKeys = true,
        includePasswords = false,
        controlSelector,
        ignoreSelector,
        mapBeforeSave,
        mapAfterLoad,
        onRestore,
        onSave,
        onError
    } = options

    const [root, setRoot] = useState<TRoot | null>(null)
    const [hasRestored, setHasRestored] = useState(false)
    const [restoredAt, setRestoredAt] = useState<number | undefined>()
    const [lastSavedAt, setLastSavedAt] = useState<number | undefined>()
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const isRestoringRef = useRef(false)
    const isDirtyRef = useRef(false)
    const mapBeforeSaveRef = useLatestRef(mapBeforeSave)
    const mapAfterLoadRef = useLatestRef(mapAfterLoad)
    const onRestoreRef = useLatestRef(onRestore)
    const onSaveRef = useLatestRef(onSave)
    const onErrorRef = useLatestRef(onError)

    const controlOptions = useMemo<DomControlOptions>(
        () => ({
            includePasswords,
            controlSelector,
            ignoreSelector
        }),
        [controlSelector, ignoreSelector, includePasswords]
    )

    const ref = useCallback((node: TRoot | null): void => {
        setRoot(node)
    }, [])

    const saveCurrentRoot = useCallback(
        (currentRoot: TRoot): StoredFormSaverData<FormSaverValues> | null => {
            if (!enabled || !storageKey) {
                return null
            }

            try {
                const values = collectDomFormValues(currentRoot, controlOptions)
                const saved = writeStoredForm<FormSaverValues>(storageKey, values, {
                    storage,
                    version,
                    mergeUnknownKeys,
                    mapBeforeSave: mapBeforeSaveRef.current
                })

                if (saved) {
                    isDirtyRef.current = false
                    setLastSavedAt(saved.meta.savedAt)
                    onSaveRef.current?.(saved.values, saved.meta)
                }

                return saved
            } catch (error) {
                onErrorRef.current?.(error)
                return null
            }
        },
        [
            controlOptions,
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

    const restoreCurrentRoot = useCallback(
        (currentRoot: TRoot): StoredFormSaverData<FormSaverValues> | null => {
            if (!enabled || !storageKey) {
                return null
            }

            try {
                const stored = readStoredForm<FormSaverValues>(storageKey, { storage })
                if (!stored) {
                    return null
                }

                const loadedValues = mapAfterLoadRef.current
                    ? mapAfterLoadRef.current(stored.values, stored.meta)
                    : stored.values

                if (!loadedValues) {
                    return null
                }

                isRestoringRef.current = true
                try {
                    restoreDomFormValues(currentRoot, loadedValues, controlOptions)
                } finally {
                    isRestoringRef.current = false
                }

                setRestoredAt(stored.meta.savedAt)
                onRestoreRef.current?.(loadedValues, stored.meta)

                return {
                    values: loadedValues,
                    meta: stored.meta
                }
            } catch (error) {
                isRestoringRef.current = false
                onErrorRef.current?.(error)
                return null
            }
        },
        [controlOptions, enabled, mapAfterLoadRef, onErrorRef, onRestoreRef, storage, storageKey]
    )

    const saveNow = useCallback((): StoredFormSaverData<FormSaverValues> | null => {
        if (!root) {
            return null
        }

        clearTimer(timerRef)
        return saveCurrentRoot(root)
    }, [root, saveCurrentRoot])

    const scheduleSave = useCallback(
        (currentRoot: TRoot): void => {
            clearTimer(timerRef)

            if (debounceMs <= 0) {
                saveCurrentRoot(currentRoot)
                return
            }

            timerRef.current = setTimeout(() => {
                saveCurrentRoot(currentRoot)
            }, debounceMs)
        },
        [debounceMs, saveCurrentRoot]
    )

    const restoreNow = useCallback((): StoredFormSaverData<FormSaverValues> | null => {
        if (!root) {
            return null
        }

        return restoreCurrentRoot(root)
    }, [restoreCurrentRoot, root])

    const resetValues = useCallback((): StoredFormSaverData<FormSaverValues> | null => {
        if (!root) {
            return null
        }

        resetDomFormValues(root, controlOptions)
        return saveCurrentRoot(root)
    }, [controlOptions, root, saveCurrentRoot])

    const clearStoredValues = useCallback((): void => {
        try {
            clearTimer(timerRef)
            removeStoredForm(storageKey, storage)
            setLastSavedAt(undefined)
        } catch (error) {
            onErrorRef.current?.(error)
        }
    }, [onErrorRef, storage, storageKey])

    const getValues = useCallback((): FormSaverValues => {
        return root ? collectDomFormValues(root, controlOptions) : {}
    }, [controlOptions, root])

    useEffect(() => {
        if (!root) {
            return
        }

        if (!enabled || !restoreOnMount) {
            setHasRestored(true)
            return
        }

        restoreCurrentRoot(root)
        setHasRestored(true)
    }, [enabled, restoreCurrentRoot, restoreOnMount, root])

    useEffect(() => {
        if (!root || !enabled) {
            return
        }

        const handleDomInput = (event: Event): void => {
            if (isRestoringRef.current) {
                return
            }

            isDirtyRef.current = true

            if (saveEvent === 'input' && shouldSaveAfterDomEvent(event)) {
                scheduleSave(root)
            }
        }

        const handleDomChange = (event: Event): void => {
            if (isRestoringRef.current) {
                return
            }

            isDirtyRef.current = true

            if (saveEvent === 'change' || shouldSaveAfterDomEvent(event)) {
                scheduleSave(root)
            }
        }

        root.addEventListener('input', handleDomInput)
        root.addEventListener('change', handleDomChange)

        return () => {
            root.removeEventListener('input', handleDomInput)
            root.removeEventListener('change', handleDomChange)
            clearTimer(timerRef)
        }
    }, [enabled, root, saveEvent, scheduleSave])

    useEffect(() => {
        if (!root || !enabled || typeof window === 'undefined') {
            return
        }

        const handleBeforeUnload = (): void => {
            if (isDirtyRef.current || timerRef.current !== null) {
                clearTimer(timerRef)
                saveCurrentRoot(root)
            }
        }

        window.addEventListener('beforeunload', handleBeforeUnload)

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
        }
    }, [enabled, root, saveCurrentRoot])

    return useMemo<UseFormSaverDomResult<TRoot>>(
        () => ({
            ref,
            getValues,
            saveNow,
            restoreNow,
            resetValues,
            clearStoredValues,
            hasRestored,
            restoredAt,
            lastSavedAt
        }),
        [
            ref,
            getValues,
            saveNow,
            restoreNow,
            resetValues,
            clearStoredValues,
            hasRestored,
            restoredAt,
            lastSavedAt
        ]
    )
}
