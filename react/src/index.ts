/**
 * Public package entry point.
 *
 * This barrel file defines the import surface that consumers use from
 * "form-saver-react". Keep exports intentional and stable: moving or removing
 * items here is a public API change even when the underlying implementation
 * remains available internally.
 */

export type { DomControlOptions } from './domControls'
export {
    collectDomFormValues,
    getDomFormControls,
    resetDomFormValues,
    restoreDomFormValues
} from './domControls'
export {
    clearStorageKeys,
    getStorage,
    readStoredForm,
    removeStoredForm,
    removeStoredValueKeys,
    writeStoredForm
} from './storage'
export type {
    BrowserStorageName,
    FormSaverFieldName,
    FormSaverMeta,
    FormSaverPrimitive,
    FormSaverValue,
    FormSaverValues,
    FormSaverValuesConstraint,
    ReadStoredFormOptions,
    StoredFormSaverData,
    UseFormSaverBinders,
    UseFormSaverDomOptions,
    UseFormSaverDomResult,
    UseFormSaverOptions,
    UseFormSaverResult,
    WriteStoredFormOptions
} from './types'
export { useFormSaver } from './useFormSaver'
export { useFormSaverDom } from './useFormSaverDom'
