/**
 * Browser storage adapter for persisted form state.
 *
 * This module owns the serialized storage envelope used by the React hook. All
 * reads, writes, and deletes are best-effort because localStorage/sessionStorage
 * may be unavailable during SSR, blocked by browser privacy settings, full, or
 * contain stale invalid JSON.
 *
 * Developer notes:
 * - Public helpers should not throw for normal browser-storage failures.
 * - Be careful when changing StoredFormSaverData shape; existing saved forms in
 *   user browsers may have been written by older versions of the package.
 */

import type {
    BrowserStorageName,
    FormSaverFieldName,
    FormSaverMeta,
    FormSaverValuesConstraint,
    ReadStoredFormOptions,
    StoredFormSaverData,
    WriteStoredFormOptions
} from './types'

const DEF_STORAGE = 'localStorage' as const // alternative is 'sessionStorage', but localStorage is more commonly used for form saving

// Returns browser storage only on the client. This keeps the module safe for SSR.
const getWindowStorage = (storageName: BrowserStorageName): Storage | null => {
    if (typeof window !== 'undefined') {
        try {
            // Access might throw an error if cookies/storage are blocked
            return window[storageName]
        } catch {
            // return null below
        }
    }
    return null
}

// Parses stored JSON without throwing, because storage may contain stale or invalid data.
const safeParseJson = (value: string | null): unknown => {
    if (value) {
        try {
            return JSON.parse(value)
        } catch {
            // return null below
        }
    }
    return null
}

// Optimized: Reduced overhead by removing helper function and using direct checks
const normalizeStoredData = <TValues extends FormSaverValuesConstraint<TValues>>(
    raw: unknown
): StoredFormSaverData<TValues> | null => {
    // We cast to a partial shape just for validation to satisfy the linter
    // raw has type StoredFormSaverData or null, but we need to check its shape manually in case of corrupted or stale data.
    const r = raw as { values?: object; meta?: { savedAt?: number } } | null

    return r && typeof r.values === 'object' && typeof r.meta?.savedAt === 'number'
        ? (r as unknown as StoredFormSaverData<TValues>)
        : null
}

// Merges current form values into existing storage while preserving unknown keys by default.
// Using a manual loop instead of (...) spread to minimize allocations.
const mergeValueObjects = <TValues extends FormSaverValuesConstraint<TValues>>(
    existingValues: Partial<TValues>,
    nextValues: Partial<TValues>,
    mergeUnknownKeys: boolean
): Partial<TValues> => {
    const result: Partial<TValues> = {}

    if (mergeUnknownKeys) {
        for (const key in existingValues) {
            result[key] = existingValues[key]
        }
    }

    for (const key in nextValues) {
        const val = nextValues[key]
        if (val === undefined) {
            delete result[key]
        } else {
            result[key] = val
        }
    }

    return result
}

export const getStorage = (storageName: BrowserStorageName = DEF_STORAGE): Storage | null =>
    getWindowStorage(storageName)

// Reads and validates one stored form envelope.
export const readStoredForm = <TValues extends FormSaverValuesConstraint<TValues>>(
    storageKey: string,
    options: ReadStoredFormOptions = {}
): StoredFormSaverData<TValues> | null => {
    const storage = getWindowStorage(options.storage ?? DEF_STORAGE)
    if (storage && storageKey) {
        try {
            return normalizeStoredData<TValues>(safeParseJson(storage.getItem(storageKey)))
        } catch {
            // return null below
        }
    }
    return null
}

// Writes a form envelope and returns the exact data that was persisted.
export const writeStoredForm = <TValues extends FormSaverValuesConstraint<TValues>>(
    storageKey: string,
    values: Partial<TValues>,
    options: WriteStoredFormOptions<TValues> = {}
): StoredFormSaverData<TValues> | null => {
    const storage = getWindowStorage(options.storage ?? DEF_STORAGE)
    if (storage && storageKey) {
        const now = options.now ?? Date.now
        const existing = readStoredForm<TValues>(storageKey, options)
        const valuesToSave = options.mapBeforeSave ? options.mapBeforeSave(values) : values
        const meta: FormSaverMeta = {
            savedAt: now()
        }

        if (options.version !== undefined) {
            meta.version = options.version
        }

        const data: StoredFormSaverData<TValues> = {
            values: mergeValueObjects<TValues>(
                existing ? existing.values : {},
                valuesToSave,
                options.mergeUnknownKeys !== false
            ),
            meta
        }

        try {
            storage.setItem(storageKey, JSON.stringify(data))
            return data
        } catch {
            // return null below
        }
    }
    return null
}

export const removeStoredForm = (
    storageKey: string,
    storageName: BrowserStorageName = DEF_STORAGE
): void => {
    const storage = getWindowStorage(storageName)
    if (storage && storageKey) {
        try {
            storage.removeItem(storageKey)
        } catch {
            // Ignore storage access errors. Some browser contexts expose Storage but block operations.
        }
    }
}

export const removeStoredValueKeys = <TValues extends FormSaverValuesConstraint<TValues>>(
    storageKey: string,
    keysToRemove: Array<FormSaverFieldName<TValues>>,
    storageName: BrowserStorageName = DEF_STORAGE
): StoredFormSaverData<TValues> | null => {
    const existing = readStoredForm<TValues>(storageKey, { storage: storageName })
    const storage = getWindowStorage(storageName)
    if (!existing || !storage) {
        return existing
    }

    // Manual loop is faster than keysToRemove.forEach() for small/medium arrays.
    for (let i = 0; i < keysToRemove.length; ++i) {
        delete existing.values[keysToRemove[i]]
    }

    try {
        storage.setItem(storageKey, JSON.stringify(existing))
        return existing
    } catch {
        return null
    }
}

// Removes all storage records whose keys start with one of the provided prefixes.
export const clearStorageKeys = (
    keyPrefix: string | string[],
    storageName: BrowserStorageName = DEF_STORAGE
): void => {
    const storage = getWindowStorage(storageName)
    if (storage && keyPrefix.length) {
        try {
            const prefixes = Array.isArray(keyPrefix) ? keyPrefix : [keyPrefix]
            const pLen = prefixes.length
            if (pLen) {
                // Iterate backwards to safely remove items by index without creating an intermediate array of keys. (Speed-optimized.)
                for (let i = storage.length - 1; i >= 0; --i) {
                    const key = storage.key(i)
                    if (key) {
                        // Speed optimized nested loop instead of possible `prefixes.some((p) => p.length > 0 && key.startsWith(p))` to avoid callback creation and overhead.
                        for (let j = 0; j < pLen; ++j) {
                            const p = prefixes[j]
                            // indexOf(p) === 0 is generally faster or equal to startsWith in most engines.
                            if (p.length > 0 && key.indexOf(p) === 0) {
                                storage.removeItem(key)
                                break
                            }
                        }
                    }
                }
            }
        } catch {
            // Ignore storage access errors. Clearing is best-effort.
        }
    }
}
