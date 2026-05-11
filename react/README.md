# FormSaver React

`form-saver-react` is a small React hook package for saving and restoring form/settings state from browser storage.

The package currently provides two public hook APIs and one wrapper component:

- `useFormSaver` for typed controlled React state.
- `useFormSaverDom` for jQuery-like auto-binding of uncontrolled native controls inside a DOM scope.
- `FormSaverScope` as a lightweight wrapper component over `useFormSaverDom`.

This package does **not** wrap the legacy jQuery plugin. It provides React/TypeScript APIs built on top of the same core idea: save values into one readable JSON envelope and restore them after reload.

## Goals

- Save form/settings state to browser storage.
- Restore state after page reload.
- Work in Next.js by avoiding browser storage access during SSR.
- Support `localStorage` and `sessionStorage`.
- Preserve unknown stored keys when multiple related forms share one `storageKey`.
- Keep the public API small and typed.
- Support a DOM auto-binding mode for ordinary native controls when fully controlled state is too verbose.

## Install / build

This directory contains the React hook package. Build output is written to `dist/`, which is the package entry point used by consuming applications.

```bash
cd react
npm install
npm run format:check
npm run lint
npm run test:run
npm run typecheck
npm run build
```

The package can be tested locally through `npm pack` or a `file:` dependency before it is published to an npm registry.

## Using it from another local project

The demo app intentionally imports the hook package from `src/` through a Vite alias so that local changes are visible immediately during package development. A real application should usually consume the package entry point instead, because that is the same path npm users will eventually use.

For a separate React or Next.js project, the closest workflow to a future npm install is:

```bash
cd react
npm run build
npm pack
```

Then install the generated tarball in the application:

```bash
npm install ../path/to/form-saver-react-0.1.0.tgz
```

After that, import from the package name:

```tsx
import { FormSaverScope, useFormSaver, useFormSaverDom } from 'form-saver-react'
```

For active local development, a path dependency is also possible:

```json
{
    "dependencies": {
        "form-saver-react": "file:../form-saver/react"
    }
}
```

With this mode, rebuild the package before testing package-output changes in the consuming app, because the package entry point points at `dist/`. Do not copy the demo alias into a real application unless you intentionally want the app bundler to compile this package from TypeScript source.

In a Next.js App Router project, any component that calls `useFormSaver` or `useFormSaverDom` must be a Client Component:

```tsx
'use client'

import { useFormSaver } from 'form-saver-react'
```

The storage helpers are SSR-safe, but the hook is still a React client hook because it uses client-side state/effects and browser storage.

## Bundle size and tree-shaking

The package is marked as side-effect-free in `package.json`:

```json
{
    "sideEffects": false
}
```

This helps production bundlers such as Next.js/Webpack, Vite/Rollup, and similar tools remove unused exports. For example, if an application imports only `useFormSaverDom`, the `FormSaverScope` wrapper should not add meaningful production bundle weight.

Development builds may still include more code for HMR and debugging. Check production builds when comparing bundle size.

## Basic usage

```tsx
import { useFormSaver } from 'form-saver-react'

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

## DOM auto-binding usage

Use `FormSaverScope` when your form mostly contains ordinary uncontrolled native controls and you do not want to spread bind helpers into every input. This is the most jQuery-like API.

```tsx
import { FormSaverScope } from 'form-saver-react'

export function SettingsForm() {
    return (
        <FormSaverScope asChild storageKey="settings-form">
            <form>
                <input name="query" defaultValue="" />

                <label>
                    <input type="checkbox" name="enabled" defaultChecked={false} />
                    Enabled
                </label>

                <label>
                    <input type="radio" name="mode" value="basic" defaultChecked />
                    Basic
                </label>

                <label>
                    <input type="radio" name="mode" value="advanced" />
                    Advanced
                </label>

                <select name="category" defaultValue="">
                    <option value="">Choose category</option>
                    <option value="general">General</option>
                    <option value="advanced">Advanced</option>
                </select>

                <select name="tags" multiple defaultValue={[]}>
                    <option value="alpha">Alpha</option>
                    <option value="beta">Beta</option>
                    <option value="gamma">Gamma</option>
                </select>

                <textarea name="notes" defaultValue="" />
            </form>
        </FormSaverScope>
    )
}
```

`asChild` means FormSaver does not render an extra DOM element. It clones the only child element and attaches its ref there. Without `asChild`, `FormSaverScope` renders a root element itself:

```tsx
<FormSaverScope as="form" storageKey="settings-form" className="settings-form">
    <input name="query" defaultValue="" />
    <textarea name="notes" defaultValue="" />
</FormSaverScope>
```

Use `useFormSaverDom` directly when you need imperative helpers such as `saveNow`, `restoreNow`, `resetValues`, or `clearStoredValues` in the component that renders the form.

```tsx
import { useFormSaverDom } from 'form-saver-react'

export function SettingsForm() {
    const formSaver = useFormSaverDom<HTMLFormElement>({
        storageKey: 'settings-form',
        debounceMs: 150,
        mergeUnknownKeys: true
    })

    return (
        <form ref={formSaver.ref}>
            <input name="query" defaultValue="" />

            <label>
                <input type="checkbox" name="enabled" defaultChecked={false} />
                Enabled
            </label>

            <label>
                <input type="radio" name="mode" value="basic" defaultChecked />
                Basic
            </label>

            <label>
                <input type="radio" name="mode" value="advanced" />
                Advanced
            </label>

            <select name="category" defaultValue="">
                <option value="">Choose category</option>
                <option value="general">General</option>
                <option value="advanced">Advanced</option>
            </select>

            <select name="tags" multiple defaultValue={[]}>
                <option value="alpha">Alpha</option>
                <option value="beta">Beta</option>
                <option value="gamma">Gamma</option>
            </select>

            <textarea name="notes" defaultValue="" />

            <button type="button" onClick={formSaver.resetValues}>
                Reset values
            </button>

            <button type="button" onClick={formSaver.clearStoredValues}>
                Clear storage
            </button>
        </form>
    )
}
```

By default, DOM mode saves on browser `change` events. For text inputs and textareas this usually means "after editing is committed", commonly when the field loses focus. Checkboxes, radio buttons, and selects fire `change` immediately. If the user types into a focused field and leaves/reloads before blur, FormSaver flushes pending DOM changes on `beforeunload`.

Set `saveEvent: 'input'` if you explicitly want save-while-typing behavior. In that mode, `debounceMs` controls the delay before writing to storage. The default debounce value is exported as `DEFAULT_FORM_SAVER_DEBOUNCE_MS` and is currently `150`.

`useFormSaverDom` scans this selector inside the scoped root:

```css
input[name], textarea[name], select[name]
```

Supported native controls:

- text-like inputs, including `number`, saved as strings;
- `textarea`;
- single `checkbox`, saved as boolean;
- checkbox groups with the same `name`, saved as `string[]`;
- radio groups, saved as the selected string value;
- single `select`;
- `select multiple`, saved as `string[]`.

The DOM API is intended for **uncontrolled** native controls. Use `defaultValue` and `defaultChecked`, not React-controlled `value` / `checked`, unless you know exactly how your component reconciles DOM values.

By default, the DOM API skips password fields, hidden inputs, file/image/button/reset/submit inputs, readonly inputs, and readonly textareas.

For custom React controls or UI-library widgets that do not render native named controls, prefer the typed `useFormSaver` API and its `bind.*` helpers. Use the DOM API only for standard named `input`, `textarea`, and `select` controls.

Dynamically added controls are not watched by a `MutationObserver` in the MVP. If a section appears after the initial restore, call `restoreNow()` after that section is mounted. This keeps the DOM mode lightweight and avoids a permanent observer for forms that do not need dynamic field discovery.

### Custom React controls with `bind`

Use `useFormSaver` when a value lives in React state, a UI-library component, or any component that is not a standard DOM control discovered by `useFormSaverDom`.

If your custom component accepts native input props, pass the matching `bind.*` result through it:

```tsx
import type { InputHTMLAttributes } from 'react'
import { useFormSaver } from 'form-saver-react'

type ProfileForm = {
    displayName: string
    newsletter: boolean
}

const initialValues: ProfileForm = {
    displayName: '',
    newsletter: false
}

function TextField(props: InputHTMLAttributes<HTMLInputElement>) {
    return <input {...props} />
}

export function ProfileForm() {
    const form = useFormSaver<ProfileForm>({
        storageKey: 'profile-form',
        initialValues
    })

    return (
        <form>
            <TextField {...form.bind.text('displayName')} />

            <label>
                <input type="checkbox" {...form.bind.checkbox('newsletter')} />
                Send newsletter
            </label>
        </form>
    )
}
```

If a UI component has a custom callback shape instead of a native `onChange` event, keep using `useFormSaver` and call `setValue` directly:

```tsx
<ToggleSwitch
    checked={form.values.newsletter}
    onCheckedChange={(checked) => form.setValue('newsletter', checked)}
/>
```

## Code quality

The React hook package uses:

- Prettier for formatting;
- ESLint for TypeScript/React correctness checks;
- Vitest for unit tests.

Run all local checks from the `react/` directory:

```bash
npm run format:check
npm run lint
npm run test:run
npm run typecheck
npm run build
```

Use `npm run lint:fix` for auto-fixable lint issues and `npm run format` for formatting.

## Tests

The React hook package uses [Vitest](https://vitest.dev/).
The test suite covers the storage helper, JSON envelope validation, `localStorage` / `sessionStorage`, merge behavior, SSR-safe behavior when browser storage is unavailable, value-key removal, prefix-based cleanup, native DOM control collection/restoration helpers, `useFormSaver`, `useFormSaverDom`, bind helpers, reset/clear helpers, and server-side string rendering safety.

Pure storage tests use a small in-memory `Storage` implementation instead of `jsdom`, so they stay fast and focused. React hook tests use `jsdom` only where a real DOM is useful.

Run tests from the `react/` directory:

```bash
npm run test:run
```

For watch mode while developing:

```bash
npm run test
```

## Demo app

A small Vite demo lives in `react/demo/`. It is intentionally simple and is meant for local manual testing of the hook package.

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

The demo is organized into three tabs: controlled bind helpers, direct `useFormSaverDom`, and `FormSaverScope asChild`. It includes text inputs, textarea, checkbox, radio buttons, checkbox groups, single select, multi-select, reset/clear/manual-save buttons, and a debug panel that shows raw saved `localStorage` JSON. The DOM tabs also include a small controlled add-on saved through bind helpers to show how custom controls can coexist with automatic native-control capture.

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
| `onError`            | `undefined`      | Called when restore/save transforms or callbacks throw. Storage access failures are ignored by the storage helpers.                                                                                         |

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

### `useFormSaverDom(options)`

```ts
useFormSaverDom({
    storageKey,
    storage: 'localStorage',
    enabled: true,
    debounceMs: 150,
    saveEvent: 'change',
    restoreOnMount: true,
    version,
    mergeUnknownKeys: true,
    includePasswords: false,
    controlSelector,
    ignoreSelector,
    mapBeforeSave,
    mapAfterLoad,
    onRestore,
    onSave,
    onError
})
```

`useFormSaverDom` returns:

```ts
const result = {
    ref,
    getValues,
    saveNow,
    restoreNow,
    resetValues,
    clearStoredValues,
    hasRestored,
    restoredAt,
    lastSavedAt
}
```

By default, password fields, hidden inputs, file/image/button/reset/submit inputs, readonly inputs, and readonly textareas are not saved. Controls matching `[data-form-saver-ignore]` or `.no-save`, or inside an element matching those selectors, are skipped.

### `FormSaverScope`

`FormSaverScope` is a lightweight wrapper around `useFormSaverDom`.

```tsx
<FormSaverScope asChild storageKey="settings">
    <form>
        <input name="query" defaultValue="" />
    </form>
</FormSaverScope>
```

Important details:

- `asChild` requires exactly one child element that can receive a React ref.
- Without `asChild`, the component renders the element passed through `as`, or `div` by default.
- The wrapper is intentionally simple. Use `useFormSaverDom` directly when you need returned helper methods.

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
