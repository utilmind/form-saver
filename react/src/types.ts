/**
 * Public TypeScript types for form-saver-react.
 *
 * These declarations describe the persisted storage envelope, hook options,
 * returned helpers, and the primitive form-value model supported by the package.
 * Because they are exported from the package entry point, most changes here are
 * consumer-facing and should be treated as API changes.
 *
 * Developer notes:
 * - Keep this module type-only; do not introduce runtime dependencies here.
 * - Preserve compatibility between these types and the runtime validation in
 *   storage.ts.
 */

import type { ChangeEventHandler, RefCallback } from 'react'

export type BrowserStorageName = 'localStorage' | 'sessionStorage'

export type FormSaverPrimitive = string | number | boolean | null
export type FormSaverValue = FormSaverPrimitive | FormSaverPrimitive[]
export type FormSaverValuesConstraint<TValues> = {
    [K in keyof TValues]: FormSaverValue | undefined
}
export type FormSaverValues = Record<string, FormSaverValue | undefined>
export type FormSaverFieldName<TValues> = Extract<keyof TValues, string>

export interface FormSaverMeta {
    savedAt: number
    version?: string | number
}

export interface StoredFormSaverData<
    TValues extends FormSaverValuesConstraint<TValues> = FormSaverValues
> {
    values: Partial<TValues>
    meta: FormSaverMeta
}

export interface ReadStoredFormOptions {
    storage?: BrowserStorageName
}

export interface WriteStoredFormOptions<
    TValues extends FormSaverValuesConstraint<TValues> = FormSaverValues
> {
    storage?: BrowserStorageName
    version?: string | number
    mergeUnknownKeys?: boolean
    now?: () => number
    mapBeforeSave?: (values: Partial<TValues>) => Partial<TValues>
}

export interface UseFormSaverOptions<TValues extends FormSaverValuesConstraint<TValues>> {
    storageKey: string
    initialValues: TValues
    storage?: BrowserStorageName
    enabled?: boolean
    debounceMs?: number
    saveOnMount?: boolean
    version?: string | number
    mergeUnknownKeys?: boolean
    restoreUnknownKeys?: boolean
    mapBeforeSave?: (values: Partial<TValues>) => Partial<TValues>
    mapAfterLoad?: (
        values: Partial<TValues>,
        meta: FormSaverMeta
    ) => Partial<TValues> | null | undefined
    onRestore?: (values: Partial<TValues>, meta: FormSaverMeta) => void
    onSave?: (values: Partial<TValues>, meta: FormSaverMeta) => void
    onError?: (error: unknown) => void
}

export interface UseFormSaverDomOptions {
    storageKey: string
    storage?: BrowserStorageName
    enabled?: boolean
    debounceMs?: number
    restoreOnMount?: boolean
    version?: string | number
    mergeUnknownKeys?: boolean
    includePasswords?: boolean
    controlSelector?: string
    ignoreSelector?: string
    mapBeforeSave?: (values: Partial<FormSaverValues>) => Partial<FormSaverValues>
    mapAfterLoad?: (
        values: Partial<FormSaverValues>,
        meta: FormSaverMeta
    ) => Partial<FormSaverValues> | null | undefined
    onRestore?: (values: Partial<FormSaverValues>, meta: FormSaverMeta) => void
    onSave?: (values: Partial<FormSaverValues>, meta: FormSaverMeta) => void
    onError?: (error: unknown) => void
}

export interface UseFormSaverDomResult<TRoot extends HTMLElement = HTMLElement> {
    ref: RefCallback<TRoot>
    getValues: () => FormSaverValues
    saveNow: () => StoredFormSaverData<FormSaverValues> | null
    restoreNow: () => StoredFormSaverData<FormSaverValues> | null
    resetValues: () => StoredFormSaverData<FormSaverValues> | null
    clearStoredValues: () => void
    hasRestored: boolean
    restoredAt?: number
    lastSavedAt?: number
}

export interface UseFormSaverBinders<TValues extends FormSaverValuesConstraint<TValues>> {
    text: <K extends FormSaverFieldName<TValues>>(
        name: K
    ) => {
        name: K
        value: string
        onChange: ChangeEventHandler<HTMLInputElement>
    }

    textarea: <K extends FormSaverFieldName<TValues>>(
        name: K
    ) => {
        name: K
        value: string
        onChange: ChangeEventHandler<HTMLTextAreaElement>
    }

    checkbox: <K extends FormSaverFieldName<TValues>>(
        name: K
    ) => {
        name: K
        checked: boolean
        onChange: ChangeEventHandler<HTMLInputElement>
    }

    radio: <K extends FormSaverFieldName<TValues>>(
        name: K,
        optionValue: NonNullable<TValues[K]>
    ) => {
        name: K
        value: string | number | readonly string[]
        checked: boolean
        onChange: ChangeEventHandler<HTMLInputElement>
    }

    select: <K extends FormSaverFieldName<TValues>>(
        name: K
    ) => {
        name: K
        value: string | number | readonly string[]
        onChange: ChangeEventHandler<HTMLSelectElement>
    }

    multiSelect: <K extends FormSaverFieldName<TValues>>(
        name: K
    ) => {
        name: K
        multiple: true
        value: readonly string[]
        onChange: ChangeEventHandler<HTMLSelectElement>
    }
}

export interface UseFormSaverResult<TValues extends FormSaverValuesConstraint<TValues>> {
    values: TValues
    setValue: <K extends FormSaverFieldName<TValues>>(name: K, value: TValues[K]) => void
    setValues: (patch: Partial<TValues> | ((current: TValues) => Partial<TValues>)) => void
    replaceValues: (nextValues: TValues) => void
    resetValues: (nextValues?: TValues) => void
    clearStoredValues: () => void
    saveNow: () => void
    hasRestored: boolean
    restoredAt?: number
    lastSavedAt?: number
    bind: UseFormSaverBinders<TValues>
}
