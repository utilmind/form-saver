/**
 * Public package entry point.
 *
 * This barrel file defines the import surface that consumers use from
 * "form-saver-react". Keep exports intentional and stable: moving or removing
 * items here is a public API change even when the underlying implementation
 * remains available internally.
 */

export {
    DEFAULT_FORM_SAVER_AUTOSAVE_INTERVAL_SECONDS,
    DEFAULT_FORM_SAVER_DEBOUNCE_MS,
    DEFAULT_FORM_SAVER_SAVE_EVENT
} from './defaults'
export type { DomControlOptions } from './domControls'
export type { FormSaverScopeProps } from './FormSaverScope'
export { FormSaverScope } from './FormSaverScope'
//
export {
    collectDomFormValues,
    getDomFormControls,
    resetDomFormValues,
    restoreDomFormValues
} from './domControls'
//
export {
    clearStorageKeys,
    getStorage,
    readStoredForm,
    removeStoredForm,
    removeStoredValueKeys,
    writeStoredForm
} from './storage'
//
export { restoreUrlHashFromStorage } from './urlHash'
//
export type {
    BrowserStorageName,
    FormSaverFieldName,
    FormSaverMeta,
    FormSaverPrimitive,
    FormSaverSaveEvent,
    FormSaverUrlHashHistoryMode,
    FormSaverUrlHashOptions,
    FormSaverValue,
    FormSaverValues,
    FormSaverValuesConstraint,
    ReadStoredFormOptions,
    RestoreUrlHashFromStorageOptions,
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
