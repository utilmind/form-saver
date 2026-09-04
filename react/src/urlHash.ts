/**
 * URL hash adapter for readable form-state synchronization.
 *
 * Values are serialized as URLSearchParams-style pairs after the # character. Primitive
 * values use one name=value pair. Arrays use one comma-delimited parameter by default or
 * repeated parameters when the separator is explicitly disabled. Empty values are omitted,
 * and boolean checkbox state is encoded as compact 1/0.
 *
 * Developer notes:
 * - Keep this module free of React dependencies so it stays easy to test.
 * - Runtime type restoration relies on the provided value template because
 *   TypeScript generic types do not exist in the browser at runtime.
 */

import { DEF_FORM_SAVER_HASH_ARRAY_SEPARATOR } from './defaults'
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

const stripLeadingHashMarker = (hash: string): string =>
    hash.charAt(0) === '#' ? hash.slice(1) : hash

/** Return the hash portion owned by FormSaver, excluding an optional opaque first segment. */
const getFormOwnedHashBody = (hash: string, keepFirstHashPart: boolean): string => {
    const hashBody = stripLeadingHashMarker(hash)

    if (!keepFirstHashPart) {
        return hashBody
    }

    const delimiterIndex = hashBody.indexOf('&')
    return delimiterIndex === -1 ? '' : hashBody.slice(delimiterIndex + 1)
}

/** Return the opaque first hash segment that another component owns. */
const getFirstHashPart = (hash: string): string => {
    const hashBody = stripLeadingHashMarker(hash)
    const delimiterIndex = hashBody.indexOf('&')

    return delimiterIndex === -1 ? hashBody : hashBody.slice(0, delimiterIndex)
}

const getHashSearchParams = (hash: string, keepFirstHashPart = false): URLSearchParams =>
    new URLSearchParams(getFormOwnedHashBody(hash, keepFirstHashPart))

/** Encode one URLSearchParams component without adding a parameter name. */
const encodeHashParamComponent = (value: string): string => {
    const params = new URLSearchParams()
    params.set('value', value)
    return params.toString().slice('value='.length)
}

/** Decode one raw URLSearchParams component without losing encoded array separators. */
const decodeHashParamComponent = (value: string): string =>
    new URLSearchParams(`value=${value}`).get('value') ?? ''

/** Read raw encoded values for one hash parameter. */
const getRawHashParamValues = (hash: string, name: string, keepFirstHashPart = false): string[] => {
    const encodedName = encodeHashParamComponent(name)
    const valuePrefix = `${encodedName}=`

    return getFormOwnedHashBody(hash, keepFirstHashPart)
        .split('&')
        .flatMap((part) => {
            if (part === encodedName) {
                return ['']
            }

            return part.startsWith(valuePrefix) ? [part.slice(valuePrefix.length)] : []
        })
}

/** Read one array parameter while preserving separators encoded inside individual values. */
const getSeparatedArrayParamValues = (
    hash: string,
    name: string,
    keepFirstHashPart: boolean,
    arraySeparator: string
): string[] =>
    getRawHashParamValues(hash, name, keepFirstHashPart).flatMap((rawValue) =>
        rawValue.split(arraySeparator).map(decodeHashParamComponent)
    )

const serializeHashParam = (name: string, value: string): string => {
    const params = new URLSearchParams()
    params.set(name, value)
    return params.toString()
}

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
    restoreUnknownKeys = false,
    keepFirstHashPart = false,
    arraySeparator: string | false = DEF_FORM_SAVER_HASH_ARRAY_SEPARATOR
): Partial<TValues> | null => {
    if (!hash || hash === '#') {
        return null
    }

    const params = getHashSearchParams(hash, keepFirstHashPart)
    const values: Partial<TValues> = {}
    let hasOwnedValue = false

    for (const key in templateValues) {
        if (!params.has(key)) {
            continue
        }

        hasOwnedValue = true
        const templateValue = templateValues[key]
        const hashValues =
            arraySeparator && Array.isArray(templateValue)
                ? getSeparatedArrayParamValues(hash, key, keepFirstHashPart, arraySeparator)
                : params.getAll(key)
        const parsedValue = parseValueByTemplate(hashValues, templateValue)

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
    keepFirstHashPart?: boolean
    arraySeparator?: string | false
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
        options.restoreUnknownKeys,
        options.keepFirstHashPart,
        options.arraySeparator
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
    defaultValues: Partial<TValues> = {},
    arraySeparator: string | false = DEF_FORM_SAVER_HASH_ARRAY_SEPARATOR
): string => {
    const serializedParams: string[] = []

    for (const key in values) {
        const value = values[key]

        if (value === undefined) {
            continue
        }

        if (Array.isArray(value)) {
            const serializedItems = value
                .filter((item) => !isEmptyHashPrimitive(item))
                .map((item) => serializePrimitive(item))

            if (serializedItems.length === 0) {
                continue
            }

            if (arraySeparator) {
                const encodedItems = serializedItems.map(encodeHashParamComponent)
                serializedParams.push(
                    `${encodeHashParamComponent(key)}=${encodedItems.join(arraySeparator)}`
                )
            } else {
                for (const item of serializedItems) {
                    serializedParams.push(serializeHashParam(key, item))
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

        serializedParams.push(serializeHashParam(key, serializePrimitive(value)))
    }

    const serialized = serializedParams.join('&')
    return serialized ? `#${serialized}` : ''
}

const updateBrowserHash = (
    nextHash: string,
    historyMode: FormSaverUrlHashHistoryMode,
    keepFirstHashPart = false
): boolean => {
    if (typeof window === 'undefined') {
        return false
    }

    const formHashBody = stripLeadingHashMarker(nextHash)
    let normalizedHash: string

    if (keepFirstHashPart) {
        const firstHashPart = getFirstHashPart(window.location.hash)

        if (formHashBody) {
            // Keep an empty first slot as `#&...` until another hash owner (for example a map
            // viewport tracker) writes its prefix. This lets that owner safely preserve our tail.
            normalizedHash = firstHashPart
                ? `#${firstHashPart}&${formHashBody}`
                : `#&${formHashBody}`
        } else {
            normalizedHash = firstHashPart ? `#${firstHashPart}` : ''
        }
    } else {
        normalizedHash = formHashBody ? `#${formHashBody}` : ''
    }

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
    defaultValues: Partial<TValues> = {},
    keepFirstHashPart = false,
    arraySeparator: string | false = DEF_FORM_SAVER_HASH_ARRAY_SEPARATOR
): boolean =>
    updateBrowserHash(
        serializeFormValuesToUrlHash(values, defaultValues, arraySeparator),
        historyMode,
        keepFirstHashPart
    )

export const clearFormValuesFromUrlHash = (
    historyMode: FormSaverUrlHashHistoryMode = 'replace',
    keepFirstHashPart = false
): boolean => updateBrowserHash('', historyMode, keepFirstHashPart)

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

    return writeFormValuesToUrlHash<TValues>(
        stored.values,
        options.historyMode,
        defaultValues,
        options.keepFirstHashPart,
        options.arraySeparator
    )
        ? stored
        : null
}
