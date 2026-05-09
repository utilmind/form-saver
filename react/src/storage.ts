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

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)

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

// Accepts only the React FormSaver envelope format. Legacy compatibility is intentionally not supported.
const normalizeStoredData = <TValues extends FormSaverValuesConstraint<TValues>>(
    raw: unknown
): StoredFormSaverData<TValues> | null =>
    isPlainObject(raw) &&
    isPlainObject(raw.values) &&
    isPlainObject(raw.meta) &&
    typeof raw.meta.savedAt === 'number'
        ? (raw as unknown as StoredFormSaverData<TValues>)
        : null

// Merges current form values into existing storage while preserving unknown keys by default.
const mergeValueObjects = <TValues extends FormSaverValuesConstraint<TValues>>(
    existingValues: Partial<TValues>,
    nextValues: Partial<TValues>,
    mergeUnknownKeys: boolean
): Partial<TValues> => {
    const result: Partial<TValues> = mergeUnknownKeys ? { ...existingValues } : {}

    for (const key in nextValues) {
        if (Object.prototype.hasOwnProperty.call(nextValues, key)) {
            if (nextValues[key] === undefined) {
                delete result[key]
            } else {
                result[key] = nextValues[key]
            }
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

    keysToRemove.forEach((key) => {
        delete existing.values[key]
    })

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

            // Iterate backwards to safely remove items by index without creating an intermediate array of keys. (Speed-optimized.)
            for (let i = storage.length - 1; i >= 0; --i) {
                const key = storage.key(i)
                if (key) {
                    // Use some() for early exit once a prefix matches
                    const matches = prefixes.some((p) => p.length > 0 && key.startsWith(p))
                    if (matches) {
                        storage.removeItem(key)
                    }
                }
            }
        } catch {
            // Ignore storage access errors. Clearing is best-effort.
        }
    }
}
