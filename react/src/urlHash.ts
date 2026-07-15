/**
 * URL hash adapter for readable form-state synchronization.
 *
 * Values are serialized as URLSearchParams after the # character. Primitive
 * values use one name=value pair, while arrays use repeated parameters. Empty
 * arrays are represented by one empty parameter so the field remains visible.
 *
 * Developer notes:
 * - Keep this module free of React dependencies so it stays easy to test.
 * - Runtime type restoration relies on the provided value template because
 *   TypeScript generic types do not exist in the browser at runtime.
 */

import type {
    FormSaverPrimitive,
    FormSaverUrlHashHistoryMode,
    FormSaverValue,
    FormSaverValuesConstraint
} from './types'

const getHashSearchParams = (hash: string): URLSearchParams =>
    new URLSearchParams(hash.charAt(0) === '#' ? hash.slice(1) : hash)

const serializePrimitive = (value: FormSaverPrimitive): string =>
    value === null ? 'null' : String(value)

const parseBoolean = (value: string): boolean | undefined => {
    const normalized = value.toLowerCase()

    if (normalized === 'true' || normalized === '1') {
        return true
    }

    if (normalized === 'false' || normalized === '0') {
        return false
    }

    return undefined
}

const parseNumber = (value: string): number | undefined => {
    if (!value.trim()) {
        return undefined
    }

    const parsed = Number(value)

    return Number.isFinite(parsed) ? parsed : undefined
}

const parsePrimitiveByTemplate = (
    value: string,
    templateValue: FormSaverPrimitive | undefined
): FormSaverPrimitive | undefined => {
    if (typeof templateValue === 'boolean') {
        return parseBoolean(value)
    }

    if (typeof templateValue === 'number') {
        return parseNumber(value)
    }

    if (templateValue === null) {
        return value === 'null' ? null : value
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

    return hasOwnedValue ? values : null
}

export const serializeFormValuesToUrlHash = <TValues extends FormSaverValuesConstraint<TValues>>(
    values: Partial<TValues>
): string => {
    const params = new URLSearchParams()

    for (const key in values) {
        const value = values[key]

        if (value === undefined) {
            continue
        }

        if (Array.isArray(value)) {
            if (!value.length) {
                params.append(key, '')
                continue
            }

            for (let index = 0; index < value.length; ++index) {
                params.append(key, serializePrimitive(value[index]))
            }
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
    historyMode: FormSaverUrlHashHistoryMode = 'replace'
): boolean => updateBrowserHash(serializeFormValuesToUrlHash(values), historyMode)

export const clearFormValuesFromUrlHash = (
    historyMode: FormSaverUrlHashHistoryMode = 'replace'
): boolean => updateBrowserHash('', historyMode)
