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
    DEFAULT_FORM_SAVER_AUTOSAVE_INTERVAL_SECONDS,
    DEFAULT_FORM_SAVER_DEBOUNCE_MS,
    DEFAULT_FORM_SAVER_SAVE_EVENT
} from './defaults'
import {
    collectDomFormDefaultValues,
    collectDomFormValues,
    type DomControlOptions,
    resetDomFormValues,
    restoreDomFormValues
} from './domControls'
import { useFocusedControlAutosave } from './focusedControlAutosave'
import { subscribeToPageUnload } from './pageUnload'
import { useBrowserLayoutEffect } from './reactEffects'
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
    getRegisteredUrlHashDefaultValues,
    resolveFormRestoreSource,
    restoreUrlHashFromStorage as restoreStoredUrlHash,
    subscribeToUrlHashDefaultValues,
    writeFormValuesToUrlHash
} from './urlHash'
import { areFormSaverValueMapsEqual, haveFormSaverValuesChanged } from './valueEquality'

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
        debounceMs = DEFAULT_FORM_SAVER_DEBOUNCE_MS,
        saveEvent = DEFAULT_FORM_SAVER_SAVE_EVENT,
        autosaveIntervalSeconds = DEFAULT_FORM_SAVER_AUTOSAVE_INTERVAL_SECONDS,
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
    const keepFirstHashPart = typeof urlHash === 'object' && urlHash.keepFirstHashPart === true

    const [root, setRoot] = useState<TRoot | null>(null)
    const rootRef = useRef<TRoot | null>(null)
    const [hasRestored, setHasRestored] = useState(false)
    const [restoredAt, setRestoredAt] = useState<number | undefined>()
    const [lastSavedAt, setLastSavedAt] = useState<number | undefined>()
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const isRestoringRef = useRef(false)
    const isDirtyRef = useRef(false)
    const autosaveActionRef = useRef<() => void>(() => undefined)
    const mapBeforeSaveRef = useLatestRef(mapBeforeSave)
    const mapAfterLoadRef = useLatestRef(mapAfterLoad)
    const onRestoreRef = useLatestRef(onRestore)
    const onSaveRef = useLatestRef(onSave)
    const onErrorRef = useLatestRef(onError)

    const { schedule: scheduleFocusedAutosave, cancel: cancelFocusedAutosave } =
        useFocusedControlAutosave({
            enabled: enabled && Boolean(root),
            intervalSeconds: autosaveIntervalSeconds,
            isDirty: () => isDirtyRef.current,
            save: () => autosaveActionRef.current()
        })

    const controlOptions = useMemo<DomControlOptions>(
        () => ({
            includePasswords,
            controlSelector,
            ignoreSelector
        }),
        [controlSelector, ignoreSelector, includePasswords]
    )

    const ref = useCallback((node: TRoot | null): void => {
        rootRef.current = node
        setRoot(node)
    }, [])

    useBrowserLayoutEffect(() => {
        if (!storageKey) {
            return
        }

        return subscribeToUrlHashDefaultValues(storageKey, storage, () => {
            const currentRoot = rootRef.current

            return currentRoot ? collectDomFormDefaultValues(currentRoot, controlOptions) : {}
        })
    }, [controlOptions, storage, storageKey])

    const writeValuesToHash = useCallback(
        (
            values: Partial<FormSaverValues>,
            saved: StoredFormSaverData<FormSaverValues> | null = null,
            preparedValues?: Partial<FormSaverValues>
        ): void => {
            if (!urlHashEnabled) {
                return
            }

            let hashValues: Partial<FormSaverValues>

            if (saved) {
                hashValues = saved.values
            } else {
                const valuesToSave =
                    preparedValues ??
                    prepareFormValuesForSave<FormSaverValues>(values, mapBeforeSaveRef.current)
                const storedValues = mergeUnknownKeys
                    ? (readStoredForm<FormSaverValues>(storageKey, { storage })?.values ?? {})
                    : {}

                hashValues = mergeFormValues<FormSaverValues>(
                    storedValues,
                    valuesToSave,
                    mergeUnknownKeys
                )
            }

            writeFormValuesToUrlHash<FormSaverValues>(
                hashValues,
                urlHashHistoryMode,
                getRegisteredUrlHashDefaultValues<FormSaverValues>(storageKey, storage),
                keepFirstHashPart
            )
        },
        [
            mapBeforeSaveRef,
            mergeUnknownKeys,
            storage,
            storageKey,
            urlHashEnabled,
            urlHashHistoryMode,
            keepFirstHashPart
        ]
    )

    const saveCurrentRoot = useCallback(
        (currentRoot: TRoot, saveToUrlHash = true): StoredFormSaverData<FormSaverValues> | null => {
            if (!enabled || !storageKey) {
                return null
            }

            try {
                const values = collectDomFormValues(currentRoot, controlOptions)
                const valuesToSave = prepareFormValuesForSave<FormSaverValues>(
                    values,
                    mapBeforeSaveRef.current
                )
                const storedBeforeSave = readStoredForm<FormSaverValues>(storageKey, { storage })
                const shouldWriteStorage =
                    !storedBeforeSave ||
                    (mergeUnknownKeys
                        ? haveFormSaverValuesChanged(valuesToSave, storedBeforeSave.values)
                        : !areFormSaverValueMapsEqual(valuesToSave, storedBeforeSave.values))
                const newlySaved = shouldWriteStorage
                    ? writeStoredForm<FormSaverValues>(storageKey, valuesToSave, {
                          storage,
                          version,
                          mergeUnknownKeys
                      })
                    : null
                const currentStored = newlySaved ?? storedBeforeSave

                if (saveToUrlHash) {
                    writeValuesToHash(values, newlySaved, valuesToSave)
                }

                if (currentStored) {
                    isDirtyRef.current = false
                    cancelFocusedAutosave()
                }

                if (newlySaved) {
                    setLastSavedAt(newlySaved.meta.savedAt)
                    onSaveRef.current?.(newlySaved.values, newlySaved.meta)
                }

                return currentStored
            } catch (error) {
                onErrorRef.current?.(error)
                return null
            }
        },
        [
            controlOptions,
            enabled,
            cancelFocusedAutosave,
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
                const initialValues = collectDomFormDefaultValues(currentRoot, controlOptions)
                const restoreSource =
                    urlHashEnabled && restoreFromUrlHash && typeof window !== 'undefined'
                        ? resolveFormRestoreSource<FormSaverValues>(
                              storageKey,
                              window.location.hash,
                              initialValues,
                              { storage, keepFirstHashPart }
                          )
                        : (() => {
                              const stored = readStoredForm<FormSaverValues>(storageKey, {
                                  storage
                              })

                              return {
                                  source: stored ? ('storage' as const) : null,
                                  values: stored?.values ?? null,
                                  stored
                              }
                          })()
                const sourceValues = restoreSource.values

                if (!sourceValues) {
                    writeValuesToHash(initialValues)
                    return null
                }

                const meta = restoreSource.stored?.meta ?? createRestoreMeta(version)
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

                if (restoreSource.source === 'hash') {
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
            keepFirstHashPart,
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
        cancelFocusedAutosave()
        return saveCurrentRoot(root)
    }, [cancelFocusedAutosave, root, saveCurrentRoot])

    autosaveActionRef.current = saveNow

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
            cancelFocusedAutosave()
            removeStoredForm(storageKey, storage)
            setLastSavedAt(undefined)
        } catch (error) {
            onErrorRef.current?.(error)
        }
    }, [cancelFocusedAutosave, onErrorRef, storage, storageKey])

    const clearUrlHashValues = useCallback((): void => {
        clearFormValuesFromUrlHash(urlHashHistoryMode, keepFirstHashPart)
    }, [keepFirstHashPart, urlHashHistoryMode])

    const restoreUrlHashFromStorage = useCallback(() => {
        return restoreStoredUrlHash<FormSaverValues>(storageKey, {
            storage,
            historyMode: urlHashHistoryMode,
            keepFirstHashPart
        })
    }, [keepFirstHashPart, storage, storageKey, urlHashHistoryMode])

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
            scheduleFocusedAutosave(event.target instanceof Element ? event.target : null)

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
            cancelFocusedAutosave()
        }
    }, [cancelFocusedAutosave, enabled, root, saveEvent, scheduleFocusedAutosave, scheduleSave])

    useEffect(() => {
        if (!root || !enabled) {
            return
        }

        return subscribeToPageUnload({
            storageKey,
            storage,
            trackUrlHash: urlHashEnabled && restoreFromUrlHash,
            save: () => {
                if (!isDirtyRef.current && timerRef.current === null) {
                    return null
                }

                clearTimer(timerRef)
                cancelFocusedAutosave()
                // Keep the current address bar unchanged while unloading. The browser may
                // reload an earlier URL snapshot even after replaceState, producing a visible
                // hash rollback before FormSaver restores the latest stored value.
                return saveCurrentRoot(root, false)
            },
            ownsField: (_fieldName, activeElement) => root.contains(activeElement)
        })
    }, [
        enabled,
        cancelFocusedAutosave,
        restoreFromUrlHash,
        root,
        saveCurrentRoot,
        storage,
        storageKey,
        urlHashEnabled
    ])

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
