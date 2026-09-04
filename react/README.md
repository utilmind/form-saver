# FormSaver React

`form-saver-react` is a small React hook package for saving and restoring form/settings state from browser storage, with optional readable URL hash synchronization.

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
- Optionally mirror controlled form values into a readable URL hash.
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

The test scripts use a small Node wrapper. On Node versions that expose built-in Web Storage, the wrapper launches Vitest with that Node-only implementation disabled so jsdom can provide browser-compatible `localStorage` and `sessionStorage`. This keeps the same commands working on supported older Node versions and on Node 25+.

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
        saveEvent: 'change',
        autosaveIntervalSeconds: 30,
        mergeUnknownKeys: true,
        urlHash: true
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

## URL hash synchronization

Set `urlHash: true` on `useFormSaver`, `useFormSaverDom`, or `FormSaverScope` to restore and mirror the form values after the `#` character. For a controlled form:

```tsx
const form = useFormSaver<SettingsForm>({
    storageKey: 'settings-form',
    initialValues,
    urlHash: true
})
```

A state such as:

```ts
{
    query: 'precision machining',
    enabled: true,
    mode: 'advanced',
    tags: ['lathe', 'mill']
}
```

is represented as readable hash parameters:

```text
#query=precision+machining&enabled=1&mode=advanced&tags=lathe&tags=mill
```

Primitive values use one `name=value` pair and arrays use repeated parameters. Empty strings, `null`, empty arrays, and empty array items are omitted from the hash. Boolean checkbox values use compact `1` / `0`; a checkbox is omitted when its current state matches its default. Controlled forms take that default from `initialValues` or the binder default, while DOM forms use the native `defaultChecked` state (the original `checked` attribute). Browser storage still keeps the complete values.

Restore order is deterministic:

1. If the hash contains at least one known form field, the hash is normally the restore source and browser storage is ignored for that restore.
2. The reload exception is a focused field that was synchronously flushed during `beforeunload` while the browser kept the previous hash for F5/reload. If only that field differs, FormSaver uses the newer stored state and rebuilds the hash.
3. Omitted string, `null`, and array fields restore as empty values. Omitted booleans keep their checkbox defaults, and omitted numbers keep their runtime template values because the value model has no separate empty-number state.
4. If no known form field is present in the hash, FormSaver falls back to `localStorage` or `sessionStorage`.
5. When the page opens without a recognized form hash, FormSaver restores the form from browser storage and automatically rebuilds the compact hash.
6. After restoration, FormSaver normalizes the hash so it contains non-empty values and only checkbox states that differ from their defaults.

This avoids mixing a shared URL with stale values from the current browser. The focused-field exception is deliberately narrow: if any other recognized hash value differs from storage, FormSaver treats the URL as a genuinely different shared state and keeps the hash authoritative. The hash is treated as belonging to the initialized FormSaver scope, so enabling this option replaces the existing hash content. The same restore order is used by controlled and DOM-based APIs.

Use the object form for one-way mirroring or explicit browser-history behavior:

```tsx
const form = useFormSaver<SettingsForm>({
    storageKey: 'settings-form',
    initialValues,
    urlHash: {
        restore: false,
        historyMode: 'replace'
    }
})
```

- `restore` defaults to `true`. Set it to `false` to write values to the hash without restoring from it.
- `historyMode` defaults to `'replace'`, which avoids adding a browser-history entry for every saved change. Use `'push'` only when each synchronized state should become a separate history entry.
- `keepFirstHashPart` defaults to `false`. Set it to `true` when another component owns the first hash segment before the first `&`. FormSaver then reads and writes only the remaining hash parameters while leaving that first segment intact. This is the React equivalent of the legacy jQuery `keep1stHash` option and is useful with map viewport trackers.
- `clearUrlHashValues()` removes only the synchronized FormSaver hash values. When `keepFirstHashPart` is enabled, the preserved first segment remains unchanged.
- `restoreUrlHashFromStorage()` explicitly rebuilds the compact hash from the complete stored value set. Normally this is unnecessary because `urlHash: true` performs the same synchronization automatically when FormSaver initializes. It is useful when a router keeps the form component mounted while hiding and showing its route.

When `keepFirstHashPart` is enabled, the first hash segment is treated as opaque. For example, a mapping application can keep its viewport first and let FormSaver own everything after the first `&`:

```text
#39.4196,-84.2093x39.3216,-84.4026&employeesRanges=6-10&showInactive=1
```

If FormSaver needs to write values before the other hash owner has created its prefix, it temporarily uses an empty first slot such as `#&employeesRanges=6-10`. A later first-segment writer can then replace only that empty prefix while preserving FormSaver's `&...` tail.

```tsx
const filters = useFormSaver<FilterSettings>({
    storageKey: 'map-filters',
    initialValues,
    urlHash: {
        keepFirstHashPart: true,
        historyMode: 'replace'
    }
})
```

The same explicit operation is also exported as a standalone helper. Pass `defaultValues` when calling it outside an active FormSaver hook so default checkbox state can be omitted correctly:

```ts
restoreUrlHashFromStorage<SettingsForm>('settings-form', {
    defaultValues: initialValues
})
```

Runtime type restoration for controlled forms uses `initialValues` and defaults registered by `bind.*`, because TypeScript types do not exist at runtime. DOM mode infers the runtime value template from the native controls currently present in its scope. Passing `initialValues` is recommended when controlled URL synchronization includes numbers, booleans, or arrays.

Text hash values preserve case. Empty values are intentionally absent from the hash; numeric and boolean values are parsed according to the runtime template, including compact checkbox `1` / `0` values.

### Reload while a field is focused

Both React APIs install a `beforeunload` flush. This covers F5 or another immediate page unload that occurs before the normal debounce or DOM `change` event has saved the latest focused field.

With the default `saveEvent: 'change'`, typing into a text input or textarea does not write browser storage or the URL hash on every keypress. Controlled binders still update React state immediately, but persist on blur. DOM mode follows the native browser `change` event, which also commonly fires on blur for text controls. Both APIs still mark the form dirty while typing and perform a synchronous save during `beforeunload`.

Some browsers can persist the storage write but reload the previous address-bar hash. FormSaver therefore does not rewrite the hash inside `beforeunload`: it synchronously saves the latest value to browser storage and records a small per-`storageKey` marker in `sessionStorage` containing the focused field name and exact save timestamp. On the next initialization it uses storage only when that one field is the sole mismatch, then rebuilds the hash once. This avoids a visible new-hash → stale-hash → restored-hash sequence. The behavior is automatic when `urlHash` is enabled; applications do not need their own unload handler.

When multiple FormSaver instances intentionally share the same `storageKey`, they are coordinated through one page-unload dispatcher. Every pending scope is flushed first, and only then is the marker written with the timestamp of the final merged storage record. A later saver therefore cannot invalidate the marker created for the focused field.

### Navigation between pages

Query parameters and hash fragments are not global browser state; they are parts of the current URL. A normal destination such as `/about/` contains neither, so a regular link or `history.pushState(null, '', '/about/')` removes both without a special FormSaver cleanup call.

```tsx
<Link to="/about/">About</Link>
```

Be careful when constructing SPA destinations by cloning `window.location.href`: changing only `pathname` preserves the old `search` and `hash`. Either navigate with the router's clean destination string or explicitly clear the inherited URL parts. When the user returns to the form route without a hash, a newly initialized FormSaver with `urlHash: true` restores storage and recreates the hash automatically.

## Controlled vs uncontrolled controls

React can render form controls in two different styles. FormSaver supports both styles, but they need different APIs.

A **controlled** control gets its current value from React state on every render:

```tsx
<input
    name="email"
    value={values.email}
    onChange={(event) => setValues({ ...values, email: event.target.value })}
/>
```

In this mode, React state is the source of truth. If any code writes directly to `input.value`, React may overwrite that DOM value on the next render. Use `useFormSaver` for this style, because it restores saved values into React state instead of writing directly to the DOM.

An **uncontrolled** control lets the browser DOM keep the current value after the initial render:

```tsx
<input name="email" defaultValue="" />
<textarea name="message" defaultValue="" />
<input type="checkbox" name="newsletter" defaultChecked={false} />
```

In this mode, React provides only the initial value through `defaultValue` / `defaultChecked`. After that, the current value lives in the DOM, so `useFormSaverDom` and `FormSaverScope` can restore and save it automatically by scanning named native controls inside a form or container.

Use this rule of thumb:

- Use `useFormSaver` when fields use `value`, `checked`, React state, live validation, conditional UI, or custom UI-library components.
- Use `useFormSaverDom` / `FormSaverScope` when fields are ordinary native `input`, `textarea`, or `select` elements with `name` attributes and no React-controlled `value` / `checked`.

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

By default, DOM mode saves on browser `change` events. For text inputs and textareas this usually means "after editing is committed", commonly when the field loses focus. Checkboxes, radio buttons, and selects fire `change` immediately. Native `input` events still mark the form dirty, so if the user leaves or reloads before blur, FormSaver synchronously flushes the current DOM values on `beforeunload`. When URL hash synchronization is enabled, the focused-field reload recovery described above prevents an older hash from undoing that save.

Set `saveEvent: 'input'` if you explicitly want save-while-typing behavior. In that mode, `debounceMs` controls the delay before writing to storage. The default is `saveEvent: 'change'` for both controlled binders and DOM scopes.

Both APIs also use `autosaveIntervalSeconds: 30` by default. After the first unsaved edit in a focused text input or textarea, FormSaver starts one timer. Continued typing does not restart that timer. If the control is still focused and its value is still dirty when the interval expires, FormSaver saves the current values and updates the hash. A successful normal save cancels the timer; a later edit starts a new interval. Set `autosaveIntervalSeconds: 0` to disable this periodic focused-control autosave.

The defaults are exported as `DEFAULT_FORM_SAVER_DEBOUNCE_MS`, `DEFAULT_FORM_SAVER_SAVE_EVENT`, and `DEFAULT_FORM_SAVER_AUTOSAVE_INTERVAL_SECONDS`.

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

The demo is organized into three tabs: controlled bind helpers, direct `useFormSaverDom`, and `FormSaverScope asChild`. The active tab is reflected in the `demo` URL query parameter, while the hash always mirrors the values for the selected tab:

- `http://localhost:5173/?demo=controlled-bind`
- `http://localhost:5173/?demo=dom-hook`
- `http://localhost:5173/?demo=scope-component`

Switching tabs first flushes pending changes from the current form and navigates to a clean URL for the selected tab. The newly mounted FormSaver instance then restores that tab from storage and rebuilds its hash through `urlHash: true`; the demo application does not serialize or restore form hashes itself.

The footer also demonstrates page navigation between `/` and `/about/`. The About destination naturally removes the demo query and hash because they are absent from its URL. Returning to `/` mounts the selected form again, and FormSaver automatically restores both its values and hash. All three tabs enable the same library-level URL synchronization: controlled bind helpers, direct `useFormSaverDom`, and `FormSaverScope asChild`.

## API draft

### `useFormSaver(options)`

```ts
useFormSaver<TValues>({
    storageKey,
    initialValues, // optional
    storage: 'localStorage',
    enabled: true,
    debounceMs: 150,
    saveEvent: 'change',
    autosaveIntervalSeconds: 30,
    saveOnMount: false,
    version,
    mergeUnknownKeys: true,
    restoreUnknownKeys: false,
    urlHash: false,
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
| `initialValues`      | `{}`             | Optional initial controlled state for the form. Recommended when you read `values` directly or need non-empty defaults. Bind helpers can infer simple defaults when it is omitted.                          |
| `storage`            | `'localStorage'` | Use `'localStorage'` or `'sessionStorage'`.                                                                                                                                                                 |
| `enabled`            | `true`           | Disable restore/save behavior when set to `false`.                                                                                                                                                          |
| `debounceMs`         | `150`            | Delay after save-triggering changes such as `saveEvent: 'input'` or non-text control changes. Use `0` to save immediately.                                                                                   |
| `saveEvent`          | `'change'`       | Controlled text and textarea binders save on blur by default. Set to `'input'` to persist while typing. Checkbox, radio, select, and explicit setter operations remain save-triggering changes.             |
| `autosaveIntervalSeconds` | `30`       | Periodically save a dirty focused text control without writing on every keypress. The timer is not restarted by continued typing. Set `0` to disable.                                                       |
| `saveOnMount`        | `false`          | When `false`, the hook does not write `initialValues` to storage immediately after the first restore cycle. Set to `true` if you want storage to be created on mount even before the user changes anything. |
| `version`            | `undefined`      | Optional storage format/application version saved in metadata.                                                                                                                                              |
| `mergeUnknownKeys`   | `true`           | Preserve stored fields that are not present in the current form state.                                                                                                                                      |
| `restoreUnknownKeys` | `false`          | Include unknown stored fields in React state. Usually keep this `false`.                                                                                                                                    |
| `urlHash`            | `false`          | Set to `true` to restore from and mirror a compact controlled state into readable URL hash parameters. Empty values and default checkbox state are omitted. The object form supports `restore`, `historyMode`, and `keepFirstHashPart`. |
| `mapBeforeSave`      | `undefined`      | Transform values before writing them to storage.                                                                                                                                                            |
| `mapAfterLoad`       | `undefined`      | Transform or reject values after loading them from storage.                                                                                                                                                 |
| `onRestore`          | `undefined`      | Called when values were restored.                                                                                                                                                                           |
| `onSave`             | `undefined`      | Called after values were saved.                                                                                                                                                                             |
| `onError`            | `undefined`      | Called when restore/save transforms or callbacks throw. Storage access failures are ignored by the storage helpers.                                                                                         |

When `initialValues` is omitted, `useFormSaver` learns field names from bind helpers during render and uses simple defaults: `''` for text-like fields, `false` for checkboxes, `[]` for multi-selects, and no selected radio value. This is convenient for simple bind-only forms.

Important: TypeScript generic types do not exist at runtime, so FormSaver cannot know your field list before you either pass `initialValues` or render bind helpers. If you read `form.values` directly in component logic, a property may be `undefined` until it is restored or changed. Either provide `initialValues` for fully typed first-render values, or use the safe access helpers:

```tsx
const form = useFormSaver<ContactFormValues>({
    storageKey: 'contact-form'
})

const messagePreview = useMemo(() => {
    const name = form.getString('name').trim()
    const message = form.getString('message').trim()

    return name ? `Name: ${name}\n${message}` : message
}, [form])
```

Use `getString(name)` for text-like fields, `getBoolean(name)` for checkbox-like values, `getArray(name)` for multi-select-like values, and `getValue(name, fallback)` when you want to provide a field-specific fallback.

### Return value

```ts
{
  values,
  setValue,
  setValues,
  replaceValues,
  resetValues,
  clearStoredValues,
  clearUrlHashValues,
  restoreUrlHashFromStorage,
  saveNow,
  getValue,
  getString,
  getBoolean,
  getArray,
  hasRestored,
  restoredAt,
  lastSavedAt,
  bind,
}
```

### Safe value helpers

These helpers are useful when `initialValues` is omitted but your component still needs to read a value for preview, validation, submit payload preparation, or conditional UI. They avoid errors such as `Cannot read properties of undefined` on first render.

```tsx
const name = form.getString('name') // '' when missing
const enabled = form.getBoolean('enabled') // false when missing
const tags = form.getArray('tags') // [] when missing
const subject = form.getValue('subject', 'General')
```

They do not replace `initialValues` for complex forms; they are a lightweight alternative for fields where simple empty defaults are enough.

### Bind helpers

The hook includes convenience binders for common controlled fields:

- `bind.text(name)`
- `bind.textarea(name)`
- `bind.checkbox(name)`
- `bind.radio(name, optionValue)`
- `bind.select(name)`
- `bind.multiSelect(name)`

You can ignore these helpers and wire controls manually with `values`, `setValue`, and `setValues`. The `saveEvent` blur/input distinction applies to `bind.text()` and `bind.textarea()`, because those helpers own the corresponding DOM events. Explicit `setValue`, `setValues`, and `replaceValues` calls are treated as committed programmatic changes and schedule persistence.

### `useFormSaverDom(options)`

```ts
useFormSaverDom({
    storageKey,
    storage: 'localStorage',
    enabled: true,
    debounceMs: 150,
    saveEvent: 'change',
    autosaveIntervalSeconds: 30,
    restoreOnMount: true,
    urlHash: false,
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
    clearUrlHashValues,
    restoreUrlHashFromStorage,
    hasRestored,
    restoredAt,
    lastSavedAt
}
```

`urlHash` has the same `true` and object forms as the controlled hook. With `urlHash: true`, DOM controls restore from a recognized hash first, otherwise from browser storage, and the compact hash is recreated automatically after mount. Native `defaultChecked` determines whether a standalone checkbox can be omitted; a non-default checked state is written as `1`, and a non-default unchecked state as `0`.

By default, password fields, hidden inputs, file/image/button/reset/submit inputs, readonly inputs, and readonly textareas are not saved. Controls matching `[data-form-saver-ignore]` or `.no-save`, or inside an element matching those selectors, are skipped.

### `FormSaverScope`

`FormSaverScope` is a lightweight wrapper around `useFormSaverDom`.

```tsx
<FormSaverScope asChild storageKey="settings" urlHash>
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

The hook starts with `initialValues` during SSR and the first client render. If `initialValues` is omitted, it starts with an empty object and bind helpers expose safe control defaults such as empty strings, `false`, or empty arrays. Saved values are restored after client-side mount.

This avoids reading `localStorage` or `sessionStorage` while rendering on the server.

## Pending work

See [`../TODO-migration-to-react.md`](../TODO-migration-to-react.md).
