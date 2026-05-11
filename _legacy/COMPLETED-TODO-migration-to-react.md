# TODO: Migration to React / TypeScript

This document tracks the migration from the legacy jQuery FormSaver plugin to a modern React/TypeScript module.

The old jQuery implementation stays in `jquery/` and should remain usable for legacy PHP + Bootstrap + jQuery projects.
The new React implementation lives in `react/`.

## Goals

- Keep the original idea: save form/settings state to browser storage and restore it after reload.
- Build a React-first API instead of wrapping the legacy jQuery plugin.
- Support Next.js safely by avoiding `localStorage` / `sessionStorage` access during server-side rendering.
- Use TypeScript for all new React code.
- Keep code comments in English.
- Preserve values from fields that are not present in the current form when several related forms share the same storage key.

## Non-goals for the first React version

- No jQuery dependency.
- No automatic DOM scanning in the first controlled-state hook API. A separate DOM-based auto-binding API can be added as its own phase.
- No Twitter Typeahead or other non-standard jQuery plugin support.
- No FontAwesome / Bootstrap-specific UI logic.
- No URL hash synchronization in the first version.

## Phase 1: Repository structure and migration plan

- [x] Keep the legacy jQuery code under `jquery/`.
- [x] Create this migration TODO document.
- [x] Create the initial `react/` directory structure.
- [x] Rewrite the root README so the repository describes both the React module and the legacy jQuery plugin.
- [x] Add a React-specific README under `react/README.md`.

## Phase 2: Core storage layer

- [x] Add a typed browser storage helper.
- [x] Support `localStorage` and `sessionStorage`.
- [x] Make all storage access SSR-safe.
- [x] Store form values in a JSON envelope with metadata.
- [x] Preserve unknown stored keys when saving a partial form state.
- [x] Add helpers for clearing one storage key and clearing multiple key prefixes.
- [x] Add a helper for removing selected stored value keys.

## Phase 3: React hook MVP

- [x] Add `useFormSaver` as the first public React API.
- [x] Restore saved values after client-side mount.
- [x] Save values after changes with optional debounce.
- [x] Add typed `setValue`, `setValues`, and `replaceValues` helpers.
- [x] Add basic bind helpers for text inputs, textarea, checkbox, radio, select, and multi-select.
- [x] Add reset and clear helpers.
- [x] Make the generic form type compatible with ordinary TypeScript interfaces.
- [x] Avoid writing initial default values to storage on first mount unless `saveOnMount` is enabled.
- [x] Fix the demo restore loop caused by non-memoized callback options.
- [x] Review the hook API against a typical Next.js settings form.
- [x] Decide whether the default debounce value should stay at `150ms`. Decision: keep `150ms` as `DEFAULT_FORM_SAVER_DEBOUNCE_MS`; controlled state uses it after React state changes, while DOM mode defaults to browser `change` events and uses debounce only after a save-triggering event.
- [x] Make `initialValues` optional for simple bind-only controlled forms; bind helpers infer simple defaults while explicit `initialValues` remains recommended for direct `values` usage and non-empty defaults.
- [x] Add safe value helpers (`getString`, `getBoolean`, `getArray`, `getValue`) for components that omit `initialValues` but still need to read values in render logic.

## Priority Phase: DOM-based auto binding

This phase is intentionally separate from the typed controlled-state `useFormSaver` API. Its goal is to provide a jQuery-like usage style for ordinary native controls inside a form or any DOM container. This phase is currently prioritized over the remaining packaging/polish tasks.

- [x] Keep the existing `useFormSaver` controlled-state API; do not replace it.
- [x] Decide the public name for the DOM API. Decision: `useFormSaverDom` for the low-level hook; `FormSaverScope` will be added later as wrapper sugar.
- [x] Add native control read/write helpers.
- [x] Add value collection from a root element using `input[name]`, `textarea[name]`, and `select[name]`.
- [x] Add value restoration into native controls from stored values.
- [x] Support text-like inputs, textarea, single select, multi-select, checkbox, checkbox groups, and radio groups.
- [x] Preserve unknown stored keys by default when saving from a partial DOM scope.
- [x] Add `useFormSaverDom` hook for attaching FormSaver to a form or container via a React ref.
- [x] Add `FormSaverScope` wrapper component on top of `useFormSaverDom`, including an `asChild` mode that does not add an extra DOM element.
- [x] Add `saveNow`, `restoreNow`, `resetValues`, and `clearStoredValues` helpers to the DOM hook.
- [x] Decide whether dynamically added controls should be handled only by explicit `restoreNow()` or by a `MutationObserver` option. Decision: use explicit `restoreNow()` for the MVP; skip `MutationObserver` to keep DOM mode small and avoid a permanent observer unless real usage proves it is needed.
- [x] Add a demo section for DOM auto mode, including `FormSaverScope asChild`.
- [x] Sync the active demo tab with the `demo` URL query parameter.
- [x] Add tests for DOM collect/restore behavior.
- [x] Add hook tests for DOM restore/save/reset/clear behavior.
- [x] Document controlled vs uncontrolled usage clearly.
- [x] Document limitations for custom React controls and UI libraries that do not render native named controls.

## Phase 4: Compatibility and behavior decisions

- [x] Decide whether the React storage format must be compatible with the legacy jQuery storage object. Decision: no compatibility layer; React stores one clean JSON envelope per `storageKey`.
- [x] Decide whether URL hash synchronization should be reintroduced later. Decision: postpone; not part of the React MVP.
- [x] Decide whether per-field load transforms are needed in the hook API. Decision: use form-level `mapAfterLoad` for now; per-field transforms can be added after real usage.
- [x] Decide whether dirty-state tracking is needed after the demo app exists. Decision: keep dirty-state internal only; it is used for immediate `beforeunload` flushing and is not exposed in the public API.
- [x] Decide whether validation integration should be built-in or left to application code. Decision: no built-in validation integration; FormSaver saves and restores the user's current input even if the application later considers it invalid.

## Phase 5: Tests

The demo app exists now, so the next test step should focus on the storage helper and merge behavior before hook testing.

- [x] Add unit tests for the storage helper.
- [x] Add unit tests for merge behavior with unknown keys.
- [x] Add hook tests for restore, save, reset, and clear behavior.
- [x] Add tests for bind helpers.
- [x] Add storage-layer tests for SSR-safe behavior when browser storage is unavailable.
- [x] Add hook-level tests for SSR-safe behavior.
- [x] Add tests for storage error handling when storage access throws.

## Phase 6: Demo React application

- [x] Create a small one-page React test application.
- [x] Add three demo tabs for controlled bind helpers, `useFormSaverDom`, and `FormSaverScope asChild`.
- [x] Include text inputs, textarea, checkbox, radio buttons, checkbox groups, single select, and multi-select.
- [x] Show current saved JSON for debugging.
- [x] Add buttons for reset, clear storage, and manual save.
- [x] Make the demo easy to build and run locally.

## Phase 7: Packaging and publishing

- [x] Decide package name. Decision: public brand name is FormSaver. The npm package name cannot use uppercase letters; unscoped `form-saver` is already occupied, so keep `form-saver-react` for local development and use a scoped name such as `@utilmind/form-saver` if publishing is planned later.
- [x] Decide package manager (`npm`, `pnpm`, or `yarn`). Decision: npm, because `react/package-lock.json` is already present.
- [x] Add final build configuration using TypeScript declaration output under `dist/`.
- [x] Add `exports` / `types` fields for package consumers.
- [x] Mark the React package as side-effect-free for production tree-shaking.
- [x] Add formatting configuration.
- [x] Add initial Vitest test configuration.
- [x] Add linting for the React module.
- [x] Decide whether GitHub Actions CI is needed. Decision: yes, for automated checks and learning; no deploy or npm publishing is attached to the workflow.
- [x] Add GitHub Actions CI for React module checks and demo build.
- [x] Add release notes / changelog.

## Open questions

1. React compatibility decision: document React 18+ as the supported baseline for now. The peer dependency remains broad (`react >=18.0.0`), so React 19 is allowed without making the library React-19-only.
2. Which stack should the one-page demo use: Vite, Next.js, or both? Decision: Vite demo under `react/demo/`; no Next.js demo is needed for now.
3. DOM auto mode dynamic controls decision: call `restoreNow()` manually after dynamic sections appear for now; no `MutationObserver` in the MVP.
