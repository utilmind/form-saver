# FormSaver React

React + TypeScript rewrite of the original FormSaver idea.

This module does **not** wrap the legacy jQuery plugin. It provides a React-first API for controlled state.

## Goals

- Save form/settings state to browser storage.
- Restore state after page reload.
- Work in Next.js by avoiding browser storage access during SSR.
- Support `localStorage` and `sessionStorage`.
- Preserve unknown stored keys when multiple related forms share one `storageKey`.
- Keep the public API small and typed.

## Install / build

This directory currently contains an early module draft.

```bash
cd react
npm install
npm run typecheck
npm run test:run
npm run build
```

The package is currently marked as `private: true` until the final API is reviewed.

## Basic usage

```tsx
import { useFormSaver } from './src'

type SettingsForm = {
    query: string
    enabled: boolean
    mode: 'basic' | 'advanced'
    category: string
    tags: string[]
    notes: string
}

const initialValues: SettingsForm = {
    query: '',
    enabled: false,
    mode: 'basic',
    category: '',
    tags: [],
    notes: ''
}

export function SettingsForm() {
    const form = useFormSaver<SettingsForm>({
        storageKey: 'settings-form',
        initialValues,
        debounceMs: 150,
        mergeUnknownKeys: true
    })

    return (
        <form>
            <input {...form.bind.text('query')} />

            <label>
                <input type="checkbox" {...form.bind.checkbox('enabled')} />
                Enabled
            </label>

            <label>
                <input type="radio" {...form.bind.radio('mode', 'basic')} />
                Basic
            </label>

            <label>
                <input type="radio" {...form.bind.radio('mode', 'advanced')} />
                Advanced
            </label>

            <select {...form.bind.select('category')}>
                <option value="">Choose category</option>
                <option value="general">General</option>
                <option value="advanced">Advanced</option>
            </select>

            <select {...form.bind.multiSelect('tags')}>
                <option value="alpha">Alpha</option>
                <option value="beta">Beta</option>
                <option value="gamma">Gamma</option>
            </select>

            <textarea {...form.bind.textarea('notes')} />

            <button type="button" onClick={() => form.resetValues()}>
                Reset values
            </button>

            <button type="button" onClick={form.clearStoredValues}>
                Clear storage
            </button>
        </form>
    )
}
```

## Tests

The React module uses [Vitest](https://vitest.dev/).
The first test suite covers the storage helper, JSON envelope validation, `localStorage` / `sessionStorage`, merge behavior, SSR-safe behavior when browser storage is unavailable, value-key removal, and prefix-based cleanup.

The storage tests use a small in-memory `Storage` implementation instead of `jsdom`, so they stay fast and focused.

Run tests from the `react/` directory:

```bash
npm run test:run
```

For watch mode while developing:

```bash
npm run test
```

## Demo app

A small Vite demo lives in `react/demo/`. It is intentionally simple and is meant for local manual testing of the hook.

On first use, install the demo dependencies:

```bash
cd react/demo
npm install
```

Then run it from `react/demo/`:

```bash
npm run dev
npm run build
npm run preview
```

Or, after installing the demo dependencies, run the helper scripts from `react/`:

```bash
npm run demo:dev
npm run demo:build
npm run demo:preview
```

The demo includes text inputs, textarea, checkbox, radio buttons, single select, multi-select, a manually wired number input, reset/clear/manual-save buttons, and a debug panel that shows both React state and the raw saved `localStorage` JSON.

## API draft

### `useFormSaver(options)`

```ts
useFormSaver<TValues>({
    storageKey,
    initialValues,
    storage: 'localStorage',
    enabled: true,
    debounceMs: 150,
    saveOnMount: false,
    version,
    mergeUnknownKeys: true,
    restoreUnknownKeys: false,
    mapBeforeSave,
    mapAfterLoad,
    onRestore,
    onSave,
    onError
})
```

### Options

| Option               | Default          | Description                                                                                                                                                                                                 |
| -------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storageKey`         | required         | Key used in browser storage.                                                                                                                                                                                |
| `initialValues`      | required         | Initial controlled state for the form.                                                                                                                                                                      |
| `storage`            | `'localStorage'` | Use `'localStorage'` or `'sessionStorage'`.                                                                                                                                                                 |
| `enabled`            | `true`           | Disable restore/save behavior when set to `false`.                                                                                                                                                          |
| `debounceMs`         | `150`            | Delay before saving after a state change. Use `0` to save immediately.                                                                                                                                      |
| `saveOnMount`        | `false`          | When `false`, the hook does not write `initialValues` to storage immediately after the first restore cycle. Set to `true` if you want storage to be created on mount even before the user changes anything. |
| `version`            | `undefined`      | Optional storage format/application version saved in metadata.                                                                                                                                              |
| `mergeUnknownKeys`   | `true`           | Preserve stored fields that are not present in the current form state.                                                                                                                                      |
| `restoreUnknownKeys` | `false`          | Include unknown stored fields in React state. Usually keep this `false`.                                                                                                                                    |
| `mapBeforeSave`      | `undefined`      | Transform values before writing them to storage.                                                                                                                                                            |
| `mapAfterLoad`       | `undefined`      | Transform or reject values after loading them from storage.                                                                                                                                                 |
| `onRestore`          | `undefined`      | Called when values were restored.                                                                                                                                                                           |
| `onSave`             | `undefined`      | Called after values were saved.                                                                                                                                                                             |
| `onError`            | `undefined`      | Called when storage access, parsing, or saving fails.                                                                                                                                                       |

### Return value

```ts
{
  values,
  setValue,
  setValues,
  replaceValues,
  resetValues,
  clearStoredValues,
  saveNow,
  hasRestored,
  restoredAt,
  lastSavedAt,
  isStorageAvailable,
  bind,
}
```

### Bind helpers

The hook includes convenience binders for common controlled fields:

- `bind.text(name)`
- `bind.textarea(name)`
- `bind.checkbox(name)`
- `bind.radio(name, optionValue)`
- `bind.select(name)`
- `bind.multiSelect(name)`

You can ignore these helpers and wire controls manually with `values`, `setValue`, and `setValues`.

## TypeScript form types

You can use ordinary TypeScript `type` aliases or `interface`s for form values.
No index signature is required.

```ts
interface SettingsFormValues {
    query: string
    enabled: boolean
    mode: 'basic' | 'advanced'
    tags: string[]
    notes: string
}
```

Each field value must still be storage-friendly: `string`, `number`, `boolean`, `null`, or an array of those primitive values.

## Storage format

The React version stores a JSON envelope:

```json
{
    "values": {
        "query": "example",
        "enabled": true
    },
    "meta": {
        "savedAt": 1710000000000,
        "version": "optional"
    }
}
```

This is intentionally cleaner than the legacy jQuery plugin storage format. Compatibility with the legacy format is not planned because the React module is used in different applications.

## Multiple related forms

If two forms share one `storageKey`, `mergeUnknownKeys: true` preserves values that are not present in the current form.

Example:

- Form A has fields `common`, `onlyA`.
- Form B has fields `common`, `onlyB`.
- Both forms use `storageKey: 'shared-settings'`.

Saving Form A updates `common` and `onlyA`, but does not delete `onlyB` from storage.
Saving Form B updates `common` and `onlyB`, but does not delete `onlyA` from storage.

## Next.js notes

The hook starts with `initialValues` during SSR and the first client render.
Saved values are restored after client-side mount.

This avoids reading `localStorage` or `sessionStorage` while rendering on the server.

## Pending work

See [`../TODO-migration-to-react.md`](../TODO-migration-to-react.md).
