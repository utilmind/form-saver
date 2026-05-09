import type {
    BrowserStorageName,
    FormSaverFieldName,
    FormSaverMeta,
    FormSaverValuesConstraint,
    ReadStoredFormOptions,
    StoredFormSaverData,
    WriteStoredFormOptions
} from './types'

// Returns browser storage only on the client. This keeps the module safe for SSR.
const getWindowStorage = (storageName: BrowserStorageName): Storage | null => {
    if (typeof window === 'undefined') {
        return null
    }

    try {
        return window[storageName]
    } catch {
        return null
    }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)

// Parses stored JSON without throwing, because storage may contain stale or invalid data.
const safeParseJson = (value: string | null): unknown => {
    if (!value) {
        return null
    }

    try {
        return JSON.parse(value)
    } catch {
        return null
    }
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

export const getStorage = (storageName: BrowserStorageName = 'localStorage'): Storage | null =>
    getWindowStorage(storageName)

// Checks whether storage can actually be written to, not just whether it exists.
export const isStorageAvailable = (storageName: BrowserStorageName = 'localStorage'): boolean => {
    const storage = getWindowStorage(storageName)
    const testKey = '_ls_tst_' // localStorage test

    if (!storage) {
        return false
    }

    try {
        storage.setItem(testKey, testKey)
        storage.removeItem(testKey)
        return true
    } catch {
        return false
    }
}

// Reads and validates one stored form envelope.
export const readStoredForm = <TValues extends FormSaverValuesConstraint<TValues>>(
    storageKey: string,
    options: ReadStoredFormOptions = {}
): StoredFormSaverData<TValues> | null => {
    const storage = getWindowStorage(options.storage ?? 'localStorage')

    return storage && storageKey
        ? normalizeStoredData<TValues>(safeParseJson(storage.getItem(storageKey)))
        : null
}

// Writes a form envelope and returns the exact data that was persisted.
export const writeStoredForm = <TValues extends FormSaverValuesConstraint<TValues>>(
    storageKey: string,
    values: Partial<TValues>,
    options: WriteStoredFormOptions<TValues> = {}
): StoredFormSaverData<TValues> | null => {
    const storage = getWindowStorage(options.storage ?? 'localStorage')
    const now = options.now ?? Date.now
    const existing = readStoredForm<TValues>(storageKey, options)
    const valuesToSave = options.mapBeforeSave ? options.mapBeforeSave(values) : values

    if (!storage || !storageKey) {
        return null
    }

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

    storage.setItem(storageKey, JSON.stringify(data))
    return data
}

export const removeStoredForm = (
    storageKey: string,
    storageName: BrowserStorageName = 'localStorage'
): void => {
    const storage = getWindowStorage(storageName)

    if (storage && storageKey) {
        storage.removeItem(storageKey)
    }
}

export const removeStoredValueKeys = <TValues extends FormSaverValuesConstraint<TValues>>(
    storageKey: string,
    keysToRemove: Array<FormSaverFieldName<TValues>>,
    storageName: BrowserStorageName = 'localStorage'
): StoredFormSaverData<TValues> | null => {
    const existing = readStoredForm<TValues>(storageKey, { storage: storageName })
    const storage = getWindowStorage(storageName)

    if (!existing || !storage) {
        return existing
    }

    keysToRemove.forEach((key) => {
        delete existing.values[key]
    })

    storage.setItem(storageKey, JSON.stringify(existing))
    return existing
}

// Removes all storage records whose keys start with one of the provided prefixes.
export const clearStorageKeys = (
    keyPrefix: string | string[],
    storageName: BrowserStorageName = 'localStorage'
): void => {
    const storage = getWindowStorage(storageName)

    if (!storage || keyPrefix.length === 0) {
        return
    }

    const prefixes = Array.isArray(keyPrefix) ? keyPrefix : [keyPrefix]
    const keysToRemove = Array.from({ length: storage.length }, (_value, index) =>
        storage.key(index)
    )
        .filter((key): key is string => Boolean(key))
        .filter((key) => prefixes.some((prefix) => prefix.length > 0 && key.startsWith(prefix)))

    keysToRemove.forEach((key) => {
        storage.removeItem(key)
    })
}
