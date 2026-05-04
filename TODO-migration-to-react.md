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
- No automatic DOM scanning like `input[name]`, `textarea[name]`, `select[name]`.
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
- [ ] Decide whether the default debounce value should stay at `150ms`.

## Phase 4: Compatibility and behavior decisions

- [x] Decide whether the React storage format must be compatible with the legacy jQuery storage object. Decision: no compatibility layer; React stores one clean JSON envelope per `storageKey`.
- [x] Decide whether URL hash synchronization should be reintroduced later. Decision: postpone; not part of the React MVP.
- [x] Decide whether per-field load transforms are needed in the hook API. Decision: use form-level `mapAfterLoad` for now; per-field transforms can be added after real usage.
- [ ] Decide whether dirty-state tracking is needed after the demo app exists.
- [ ] Decide whether validation integration should be built-in or left to application code.

## Phase 5: Tests

The demo app exists now, so the next test step should focus on the storage helper and merge behavior before hook testing.

- [x] Add unit tests for the storage helper.
- [x] Add unit tests for merge behavior with unknown keys.
- [ ] Add hook tests for restore, save, reset, and clear behavior.
- [ ] Add tests for bind helpers.
- [x] Add storage-layer tests for SSR-safe behavior when browser storage is unavailable.
- [ ] Add hook-level tests for SSR-safe behavior.
- [ ] Add tests for storage error handling when storage access throws.

## Phase 6: Demo React application

- [x] Create a small one-page React test application.
- [x] Include text inputs, textarea, checkbox, radio buttons, single select, and multi-select.
- [x] Show current saved JSON for debugging.
- [x] Add buttons for reset, clear storage, and manual save.
- [x] Make the demo easy to build and run locally.

## Phase 7: Packaging and publishing

- [ ] Decide package name.
- [x] Decide package manager (`npm`, `pnpm`, or `yarn`). Decision: npm, because `react/package-lock.json` is already present.
- [ ] Add final build configuration.
- [ ] Add `exports` / `types` fields for package consumers.
- [x] Add formatting configuration.
- [x] Add initial Vitest test configuration.
- [x] Add linting for the React module.
- [x] Decide whether GitHub Actions CI is needed. Decision: yes, for automated checks and learning; no deploy or npm publishing is attached to the workflow.
- [x] Add GitHub Actions CI for React module checks and demo build.
- [x] Add release notes / changelog.

## Open questions

1. Which Next.js and React versions should be considered the main target?
2. Which stack should the one-page demo use: Vite, Next.js, or both? Decision: Vite demo under `react/demo/`; no Next.js demo is needed for now.
3. Should dirty-state tracking be exposed by the hook?
4. Should validation integration be built-in or left entirely to application code?
