/**
 * URL hash adapter for readable form-state synchronization.
 *
 * Values are serialized as URLSearchParams after the # character. Primitive
 * values use one name=value pair, while arrays use repeated parameters. Empty
 * values are omitted, and boolean checkbox state is encoded as compact 1/0.
 *
 * Developer notes:
 * - Keep this module free of React dependencies so it stays easy to test.
 * - Runtime type restoration relies on the provided value template because
 *   TypeScript generic types do not exist in the browser at runtime.
 */

import { shouldPreferStorageAfterPageUnload } from './pageUnload'
import { readStoredForm } from './storage'
import type {
    BrowserStorageName,
    FormSaverPrimitive,
    FormSaverUrlHashHistoryMode,
    FormSaverValue,
    FormSaverValues,
    FormSaverValuesConstraint,
    RestoreUrlHashFromStorageOptions,
    StoredFormSaverData
} from './types'

type UrlHashDefaultValuesProvider = () => Partial<FormSaverValues>

type UrlHashDefaultValuesSubscription = {
    provider: UrlHashDefaultValuesProvider
    storage: BrowserStorageName
    storageKey: string
}

const urlHashDefaultValuesSubscriptions = new Map<number, UrlHashDefaultValuesSubscription>()
let nextUrlHashDefaultValuesSubscriptionId = 1

export const subscribeToUrlHashDefaultValues = (
    storageKey: string,
    storage: BrowserStorageName,
    provider: UrlHashDefaultValuesProvider
): (() => void) => {
    const id = nextUrlHashDefaultValuesSubscriptionId++

    urlHashDefaultValuesSubscriptions.set(id, {
        provider,
        storage,
        storageKey
    })

    return () => {
        urlHashDefaultValuesSubscriptions.delete(id)
    }
}

export const getRegisteredUrlHashDefaultValues = <
    TValues extends FormSaverValuesConstraint<TValues>
>(
    storageKey: string,
    storage: BrowserStorageName
): Partial<TValues> => {
    const defaultValues: Partial<TValues> = {}

    urlHashDefaultValuesSubscriptions.forEach((subscription) => {
        if (subscription.storageKey !== storageKey || subscription.storage !== storage) {
            return
        }

        try {
            Object.assign(defaultValues, subscription.provider())
        } catch {
            // A detached or custom scope must not prevent another saver from updating the hash.
        }
    })

    return defaultValues
}

const getHashSearchParams = (hash: string): URLSearchParams =>
    new URLSearchParams(hash.charAt(0) === '#' ? hash.slice(1) : hash)

const serializePrimitive = (value: FormSaverPrimitive): string => {
    if (typeof value === 'boolean') {
        return value ? '1' : '0'
    }

    return value === null ? 'null' : String(value)
}

const isEmptyHashPrimitive = (value: FormSaverPrimitive): boolean => value === '' || value === null

const parsePrimitiveByTemplate = (
    value: string,
    templateValue: FormSaverPrimitive | undefined
): FormSaverPrimitive | undefined => {
    if (templateValue === null) {
        return value === 'null' ? null : value
    }

    if (typeof templateValue === 'number') {
        const normalizedValue = value.trim()
        if (!normalizedValue) {
            return undefined
        }

        const parsed = Number(normalizedValue)
        return Number.isFinite(parsed) ? parsed : undefined
    }

    if (typeof templateValue === 'boolean') {
        const normalizedValue = value.trim().toLowerCase()
        if (!normalizedValue || normalizedValue === '0' || normalizedValue === 'off') {
            return false
        }

        const firstCharacter = normalizedValue[0]
        return firstCharacter !== 'f' && firstCharacter !== 'n'
    }

    return value
}

const parseValueByTemplate = (
    values: string[],
    templateValue: FormSaverValue | undefined
): FormSaverValue | undefined => {
    if (Array.isArray(templateValue)) {
        if (values.length === 1 && values[0] === '') {
            return []
        }

        const itemTemplate = templateValue[0]
        const parsedValues: FormSaverPrimitive[] = []

        for (let index = 0; index < values.length; ++index) {
            const parsedValue = parsePrimitiveByTemplate(values[index], itemTemplate)

            if (parsedValue === undefined) {
                return undefined
            }

            parsedValues.push(parsedValue)
        }

        return parsedValues
    }

    return parsePrimitiveByTemplate(values[values.length - 1] ?? '', templateValue)
}

const parseUnknownValue = (values: string[]): FormSaverValue =>
    values.length > 1 ? values : (values[0] ?? '')

const getOmittedHashValue = (
    templateValue: FormSaverValue | undefined
): FormSaverValue | undefined => {
    if (Array.isArray(templateValue)) {
        return []
    }

    if (typeof templateValue === 'string') {
        return ''
    }

    return templateValue
}

export const readFormValuesFromUrlHash = <TValues extends FormSaverValuesConstraint<TValues>>(
    hash: string,
    templateValues: TValues,
    restoreUnknownKeys = false
): Partial<TValues> | null => {
    if (!hash || hash === '#') {
        return null
    }

    const params = getHashSearchParams(hash)
    const values: Partial<TValues> = {}
    let hasOwnedValue = false

    for (const key in templateValues) {
        if (!params.has(key)) {
            continue
        }

        hasOwnedValue = true
        const parsedValue = parseValueByTemplate(params.getAll(key), templateValues[key])

        if (parsedValue !== undefined) {
            values[key] = parsedValue as TValues[typeof key]
        }
    }

    if (restoreUnknownKeys) {
        const processedKeys = new Set<string>()

        params.forEach((_value, key) => {
            if (processedKeys.has(key) || key in templateValues) {
                return
            }

            processedKeys.add(key)
            hasOwnedValue = true
            values[key as keyof TValues] = parseUnknownValue(
                params.getAll(key)
            ) as TValues[keyof TValues]
        })
    }

    if (!hasOwnedValue) {
        return null
    }

    for (const key in templateValues) {
        if (params.has(key)) {
            continue
        }

        const omittedValue = getOmittedHashValue(templateValues[key])
        if (omittedValue !== undefined) {
            values[key] = omittedValue as TValues[typeof key]
        }
    }

    return values
}

export type FormRestoreSource<TValues extends FormSaverValuesConstraint<TValues>> = {
    source: 'hash' | 'storage' | null
    values: Partial<TValues> | null
    stored: StoredFormSaverData<TValues> | null
}

interface ResolveFormRestoreSourceOptions {
    storage?: BrowserStorageName
    restoreUnknownKeys?: boolean
}

export const resolveFormRestoreSource = <TValues extends FormSaverValuesConstraint<TValues>>(
    storageKey: string,
    hash: string,
    templateValues: TValues,
    options: ResolveFormRestoreSourceOptions = {}
): FormRestoreSource<TValues> => {
    const storageName = options.storage ?? 'localStorage'
    const hashValues = readFormValuesFromUrlHash<TValues>(
        hash,
        templateValues,
        options.restoreUnknownKeys
    )
    const stored = readStoredForm<TValues>(storageKey, { storage: storageName })

    if (hashValues) {
        if (
            stored &&
            shouldPreferStorageAfterPageUnload<TValues>(storageKey, storageName, hashValues, stored)
        ) {
            return {
                source: 'storage',
                values: stored.values,
                stored
            }
        }

        return {
            source: 'hash',
            values: hashValues,
            stored: null
        }
    }

    return stored
        ? {
              source: 'storage',
              values: stored.values,
              stored
          }
        : {
              source: null,
              values: null,
              stored: null
          }
}

export const serializeFormValuesToUrlHash = <TValues extends FormSaverValuesConstraint<TValues>>(
    values: Partial<TValues>,
    defaultValues: Partial<TValues> = {}
): string => {
    const params = new URLSearchParams()

    for (const key in values) {
        const value = values[key]

        if (value === undefined) {
            continue
        }

        if (Array.isArray(value)) {
            for (let index = 0; index < value.length; ++index) {
                const item = value[index]

                if (!isEmptyHashPrimitive(item)) {
                    params.append(key, serializePrimitive(item))
                }
            }
            continue
        }

        if (isEmptyHashPrimitive(value)) {
            continue
        }

        const defaultValue = defaultValues[key]
        if (
            typeof value === 'boolean' &&
            typeof defaultValue === 'boolean' &&
            value === defaultValue
        ) {
            continue
        }

        params.set(key, serializePrimitive(value))
    }

    const serialized = params.toString()
    return serialized ? `#${serialized}` : ''
}

const updateBrowserHash = (nextHash: string, historyMode: FormSaverUrlHashHistoryMode): boolean => {
    if (typeof window === 'undefined') {
        return false
    }

    const normalizedHash = nextHash && nextHash.charAt(0) !== '#' ? `#${nextHash}` : nextHash
    if (window.location.hash === normalizedHash) {
        return true
    }

    const url = new URL(window.location.href)
    url.hash = normalizedHash

    if (historyMode === 'push') {
        window.history.pushState(null, '', url)
    } else {
        window.history.replaceState(null, '', url)
    }

    return true
}

export const writeFormValuesToUrlHash = <TValues extends FormSaverValuesConstraint<TValues>>(
    values: Partial<TValues>,
    historyMode: FormSaverUrlHashHistoryMode = 'replace',
    defaultValues: Partial<TValues> = {}
): boolean => updateBrowserHash(serializeFormValuesToUrlHash(values, defaultValues), historyMode)

export const clearFormValuesFromUrlHash = (
    historyMode: FormSaverUrlHashHistoryMode = 'replace'
): boolean => updateBrowserHash('', historyMode)

export const restoreUrlHashFromStorage = <TValues extends FormSaverValuesConstraint<TValues>>(
    storageKey: string,
    options: RestoreUrlHashFromStorageOptions<TValues> = {}
): StoredFormSaverData<TValues> | null => {
    const storage = options.storage ?? 'localStorage'
    const stored = readStoredForm<TValues>(storageKey, { storage })
    if (!stored) {
        return null
    }

    const registeredDefaults = getRegisteredUrlHashDefaultValues<TValues>(storageKey, storage)
    const defaultValues = Object.assign(registeredDefaults, options.defaultValues)

    return writeFormValuesToUrlHash<TValues>(stored.values, options.historyMode, defaultValues)
        ? stored
        : null
}
