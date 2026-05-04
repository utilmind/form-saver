import type React from 'react';

export type BrowserStorageName = 'localStorage' | 'sessionStorage';

export type FormSaverPrimitive = string | number | boolean | null;
export type FormSaverValue = FormSaverPrimitive | FormSaverPrimitive[];
export type FormSaverValuesConstraint<TValues> = {
  [K in keyof TValues]: FormSaverValue | undefined;
};
export type FormSaverValues = Record<string, FormSaverValue | undefined>;
export type FormSaverFieldName<TValues> = Extract<keyof TValues, string>;

export interface FormSaverMeta {
  savedAt: number;
  version?: string | number;
}

export interface StoredFormSaverData<TValues extends FormSaverValuesConstraint<TValues> = FormSaverValues> {
  values: Partial<TValues>;
  meta: FormSaverMeta;
}

export interface ReadStoredFormOptions {
  storage?: BrowserStorageName;
}

export interface WriteStoredFormOptions<TValues extends FormSaverValuesConstraint<TValues> = FormSaverValues> {
  storage?: BrowserStorageName;
  version?: string | number;
  mergeUnknownKeys?: boolean;
  now?: () => number;
  mapBeforeSave?: (values: Partial<TValues>) => Partial<TValues>;
}

export interface UseFormSaverOptions<TValues extends FormSaverValuesConstraint<TValues>> {
  storageKey: string;
  initialValues: TValues;
  storage?: BrowserStorageName;
  enabled?: boolean;
  debounceMs?: number;
  saveOnMount?: boolean;
  version?: string | number;
  mergeUnknownKeys?: boolean;
  restoreUnknownKeys?: boolean;
  mapBeforeSave?: (values: Partial<TValues>) => Partial<TValues>;
  mapAfterLoad?: (values: Partial<TValues>, meta: FormSaverMeta) => Partial<TValues> | null | undefined;
  onRestore?: (values: Partial<TValues>, meta: FormSaverMeta) => void;
  onSave?: (values: Partial<TValues>, meta: FormSaverMeta) => void;
  onError?: (error: unknown) => void;
}

export interface UseFormSaverBinders<TValues extends FormSaverValuesConstraint<TValues>> {
  text: <K extends FormSaverFieldName<TValues>>(
    name: K
  ) => {
    name: K;
    value: string;
    onChange: React.ChangeEventHandler<HTMLInputElement>;
  };

  textarea: <K extends FormSaverFieldName<TValues>>(
    name: K
  ) => {
    name: K;
    value: string;
    onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
  };

  checkbox: <K extends FormSaverFieldName<TValues>>(
    name: K
  ) => {
    name: K;
    checked: boolean;
    onChange: React.ChangeEventHandler<HTMLInputElement>;
  };

  radio: <K extends FormSaverFieldName<TValues>>(
    name: K,
    optionValue: NonNullable<TValues[K]>
  ) => {
    name: K;
    value: string | number | readonly string[];
    checked: boolean;
    onChange: React.ChangeEventHandler<HTMLInputElement>;
  };

  select: <K extends FormSaverFieldName<TValues>>(
    name: K
  ) => {
    name: K;
    value: string | number | readonly string[];
    onChange: React.ChangeEventHandler<HTMLSelectElement>;
  };

  multiSelect: <K extends FormSaverFieldName<TValues>>(
    name: K
  ) => {
    name: K;
    multiple: true;
    value: readonly string[];
    onChange: React.ChangeEventHandler<HTMLSelectElement>;
  };
}

export interface UseFormSaverResult<TValues extends FormSaverValuesConstraint<TValues>> {
  values: TValues;
  setValue: <K extends FormSaverFieldName<TValues>>(name: K, value: TValues[K]) => void;
  setValues: (patch: Partial<TValues> | ((current: TValues) => Partial<TValues>)) => void;
  replaceValues: (nextValues: TValues) => void;
  resetValues: (nextValues?: TValues) => void;
  clearStoredValues: () => void;
  saveNow: () => void;
  hasRestored: boolean;
  restoredAt?: number;
  lastSavedAt?: number;
  isStorageAvailable: boolean;
  bind: UseFormSaverBinders<TValues>;
}
