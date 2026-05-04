import type {
  BrowserStorageName,
  FormSaverFieldName,
  FormSaverMeta,
  FormSaverValues,
  ReadStoredFormOptions,
  StoredFormSaverData,
  WriteStoredFormOptions,
} from './types';

// Returns browser storage only on the client. This keeps the module safe for SSR.
function getWindowStorage(storageName: BrowserStorageName): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window[storageName] || null;
  } catch (_error) {
    return null;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// Parses stored JSON without throwing, because storage may contain stale or invalid data.
function safeParseJson(value: string | null): unknown {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

// Accepts only the React FormSaver envelope format. Legacy compatibility can be added later.
function normalizeStoredData<TValues extends FormSaverValues>(raw: unknown): StoredFormSaverData<TValues> | null {
  if (!isPlainObject(raw)) {
    return null;
  }

  if (isPlainObject(raw.values) && isPlainObject(raw.meta) && typeof raw.meta.savedAt === 'number') {
    return raw as unknown as StoredFormSaverData<TValues>;
  }

  return null;
}

// Merges current form values into existing storage while preserving unknown keys by default.
function mergeValueObjects<TValues extends FormSaverValues>(
  existingValues: Partial<TValues>,
  nextValues: Partial<TValues>,
  mergeUnknownKeys: boolean
): Partial<TValues> {
  var result: Partial<TValues> = mergeUnknownKeys ? { ...existingValues } : {};
  var key: keyof TValues;

  for (key in nextValues) {
    if (Object.prototype.hasOwnProperty.call(nextValues, key)) {
      if (nextValues[key] === undefined) {
        delete result[key];
      } else {
        result[key] = nextValues[key];
      }
    }
  }

  return result;
}

export function getStorage(storageName: BrowserStorageName = 'localStorage'): Storage | null {
  return getWindowStorage(storageName);
}

// Checks whether storage can actually be written to, not just whether it exists.
export function isStorageAvailable(storageName: BrowserStorageName = 'localStorage'): boolean {
  var storage = getWindowStorage(storageName);
  var testKey = '__form_saver_storage_test__';

  if (!storage) {
    return false;
  }

  try {
    storage.setItem(testKey, testKey);
    storage.removeItem(testKey);
    return true;
  } catch (_error) {
    return false;
  }
}

// Reads and validates one stored form envelope.
export function readStoredForm<TValues extends FormSaverValues>(
  storageKey: string,
  options: ReadStoredFormOptions = {}
): StoredFormSaverData<TValues> | null {
  var storage = getWindowStorage(options.storage || 'localStorage');

  if (!storage || !storageKey) {
    return null;
  }

  return normalizeStoredData<TValues>(safeParseJson(storage.getItem(storageKey)));
}

// Writes a form envelope and returns the exact data that was persisted.
export function writeStoredForm<TValues extends FormSaverValues>(
  storageKey: string,
  values: Partial<TValues>,
  options: WriteStoredFormOptions<TValues> = {}
): StoredFormSaverData<TValues> | null {
  var storage = getWindowStorage(options.storage || 'localStorage');
  var now = options.now || Date.now;
  var existing = readStoredForm<TValues>(storageKey, options);
  var valuesToSave = options.mapBeforeSave ? options.mapBeforeSave(values) : values;
  var meta: FormSaverMeta;
  var data: StoredFormSaverData<TValues>;

  if (!storage || !storageKey) {
    return null;
  }

  meta = {
    savedAt: now(),
  };

  if (options.version !== undefined) {
    meta.version = options.version;
  }

  data = {
    values: mergeValueObjects<TValues>(
      existing ? existing.values : {},
      valuesToSave,
      options.mergeUnknownKeys !== false
    ),
    meta: meta,
  };

  storage.setItem(storageKey, JSON.stringify(data));
  return data;
}

export function removeStoredForm(storageKey: string, storageName: BrowserStorageName = 'localStorage'): void {
  var storage = getWindowStorage(storageName);

  if (storage && storageKey) {
    storage.removeItem(storageKey);
  }
}

export function removeStoredValueKeys<TValues extends FormSaverValues>(
  storageKey: string,
  keysToRemove: Array<FormSaverFieldName<TValues>>,
  storageName: BrowserStorageName = 'localStorage'
): StoredFormSaverData<TValues> | null {
  var existing = readStoredForm<TValues>(storageKey, { storage: storageName });
  var storage = getWindowStorage(storageName);
  var i: number;

  if (!existing || !storage) {
    return existing;
  }

  for (i = 0; i < keysToRemove.length; i += 1) {
    delete existing.values[keysToRemove[i]];
  }

  storage.setItem(storageKey, JSON.stringify(existing));
  return existing;
}

// Removes all storage records whose keys start with one of the provided prefixes.
export function clearStorageKeys(
  keyPrefix: string | string[],
  storageName: BrowserStorageName = 'localStorage'
): void {
  var storage = getWindowStorage(storageName);
  var prefixes: string[];
  var keysToRemove: string[] = [];
  var key: string | null;
  var i: number;
  var j: number;

  if (!storage || !keyPrefix) {
    return;
  }

  prefixes = typeof keyPrefix === 'string' ? [keyPrefix] : keyPrefix;

  for (i = 0; i < storage.length; i += 1) {
    key = storage.key(i);

    if (!key) {
      continue;
    }

    for (j = 0; j < prefixes.length; j += 1) {
      if (prefixes[j] && key.slice(0, prefixes[j].length) === prefixes[j]) {
        keysToRemove.push(key);
        break;
      }
    }
  }

  for (i = 0; i < keysToRemove.length; i += 1) {
    storage.removeItem(keysToRemove[i]);
  }
}
