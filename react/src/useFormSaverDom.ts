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
import {
    mergeFormValues,
    prepareFormValuesForSave,
    readStoredForm,
    removeStoredForm,
    writeStoredForm
} from './storage'
import type {
    FormSaverMeta,
    FormSaverValues,
    StoredFormSaverData,
    UseFormSaverDomOptions,
    UseFormSaverDomResult
} from './types'
import {
    clearFormValuesFromUrlHash,
    readFormValuesFromUrlHash,
    restoreUrlHashFromStorage as restoreStoredUrlHash,
    writeFormValuesToUrlHash
} from './urlHash'

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

const createRestoreMeta = (version: string | number | undefined): FormSaverMeta => ({
    savedAt: Date.now(),
    ...(version === undefined ? {} : { version })
})

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
        urlHash = false,
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

    const urlHashEnabled = urlHash === true || typeof urlHash === 'object'
    const restoreFromUrlHash =
        urlHash === true || (typeof urlHash === 'object' && urlHash.restore !== false)
    const urlHashHistoryMode =
        typeof urlHash === 'object' ? (urlHash.historyMode ?? 'replace') : 'replace'

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

    const writeValuesToHash = useCallback(
        (
            values: Partial<FormSaverValues>,
            saved: StoredFormSaverData<FormSaverValues> | null = null
        ): void => {
            if (!urlHashEnabled) {
                return
            }

            if (saved) {
                writeFormValuesToUrlHash<FormSaverValues>(saved.values, urlHashHistoryMode)
                return
            }

            const valuesToSave = prepareFormValuesForSave<FormSaverValues>(
                values,
                mapBeforeSaveRef.current
            )
            const storedValues = mergeUnknownKeys
                ? (readStoredForm<FormSaverValues>(storageKey, { storage })?.values ?? {})
                : {}
            const hashValues = mergeFormValues<FormSaverValues>(
                storedValues,
                valuesToSave,
                mergeUnknownKeys
            )

            writeFormValuesToUrlHash<FormSaverValues>(hashValues, urlHashHistoryMode)
        },
        [
            mapBeforeSaveRef,
            mergeUnknownKeys,
            storage,
            storageKey,
            urlHashEnabled,
            urlHashHistoryMode
        ]
    )

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

                writeValuesToHash(values, saved)

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
            version,
            writeValuesToHash
        ]
    )

    const restoreCurrentRoot = useCallback(
        (currentRoot: TRoot): StoredFormSaverData<FormSaverValues> | null => {
            if (!enabled || !storageKey) {
                return null
            }

            try {
                const initialValues = collectDomFormValues(currentRoot, controlOptions)
                const hashValues =
                    urlHashEnabled && restoreFromUrlHash && typeof window !== 'undefined'
                        ? readFormValuesFromUrlHash<FormSaverValues>(
                              window.location.hash,
                              initialValues
                          )
                        : null
                const stored = hashValues
                    ? null
                    : readStoredForm<FormSaverValues>(storageKey, { storage })
                const sourceValues = hashValues ?? stored?.values

                if (!sourceValues) {
                    writeValuesToHash(initialValues)
                    return null
                }

                const meta = stored?.meta ?? createRestoreMeta(version)
                const loadedValues = mapAfterLoadRef.current
                    ? mapAfterLoadRef.current(sourceValues, meta)
                    : sourceValues

                if (!loadedValues) {
                    return null
                }

                isRestoringRef.current = true
                try {
                    restoreDomFormValues(currentRoot, loadedValues, controlOptions)
                } finally {
                    isRestoringRef.current = false
                }

                const completeValues = collectDomFormValues(currentRoot, controlOptions)

                setRestoredAt(meta.savedAt)
                onRestoreRef.current?.(loadedValues, meta)

                let result: StoredFormSaverData<FormSaverValues> = {
                    values: loadedValues,
                    meta
                }

                if (hashValues) {
                    const saved = writeStoredForm<FormSaverValues>(storageKey, completeValues, {
                        storage,
                        version,
                        mergeUnknownKeys,
                        mapBeforeSave: mapBeforeSaveRef.current
                    })

                    writeValuesToHash(completeValues, saved)

                    if (saved) {
                        result = saved
                        setLastSavedAt(saved.meta.savedAt)
                        onSaveRef.current?.(saved.values, saved.meta)
                    }
                } else {
                    writeValuesToHash(completeValues)
                }

                return result
            } catch (error) {
                isRestoringRef.current = false
                onErrorRef.current?.(error)
                return null
            }
        },
        [
            controlOptions,
            enabled,
            mapAfterLoadRef,
            mapBeforeSaveRef,
            mergeUnknownKeys,
            onErrorRef,
            onRestoreRef,
            onSaveRef,
            restoreFromUrlHash,
            storage,
            storageKey,
            urlHashEnabled,
            version,
            writeValuesToHash
        ]
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

    const clearUrlHashValues = useCallback((): void => {
        clearFormValuesFromUrlHash(urlHashHistoryMode)
    }, [urlHashHistoryMode])

    const restoreUrlHashFromStorage = useCallback(() => {
        return restoreStoredUrlHash<FormSaverValues>(storageKey, {
            storage,
            historyMode: urlHashHistoryMode
        })
    }, [storage, storageKey, urlHashHistoryMode])

    const getValues = useCallback((): FormSaverValues => {
        return root ? collectDomFormValues(root, controlOptions) : {}
    }, [controlOptions, root])

    useEffect(() => {
        if (!root) {
            return
        }

        if (!enabled) {
            setHasRestored(true)
            return
        }

        if (restoreOnMount) {
            restoreCurrentRoot(root)
        } else {
            writeValuesToHash(collectDomFormValues(root, controlOptions))
        }

        setHasRestored(true)
    }, [controlOptions, enabled, restoreCurrentRoot, restoreOnMount, root, writeValuesToHash])

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
            clearUrlHashValues,
            restoreUrlHashFromStorage,
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
            clearUrlHashValues,
            restoreUrlHashFromStorage,
            hasRestored,
            restoredAt,
            lastSavedAt
        ]
    )
}
