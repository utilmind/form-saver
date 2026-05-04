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
- [ ] Review the hook API against a real Next.js settings form.
- [ ] Decide whether the default debounce value should stay at `150ms`.

## Phase 4: Compatibility and behavior decisions

- [ ] Decide whether the React storage format must be compatible with the legacy jQuery storage object.
- [ ] Decide whether URL hash synchronization should be reintroduced later.
- [ ] Decide whether per-field load transforms are needed in the hook API.
- [ ] Decide whether dirty-state tracking is needed.
- [ ] Decide whether validation integration should be built-in or left to application code.

## Phase 5: Tests

- [ ] Add unit tests for the storage helper.
- [ ] Add unit tests for merge behavior with unknown keys.
- [ ] Add hook tests for restore, save, reset, and clear behavior.
- [ ] Add tests for bind helpers.
- [ ] Add tests for SSR-safe behavior.

## Phase 6: Demo React application

- [ ] Create a small one-page React test application.
- [ ] Include text inputs, textarea, checkbox, radio buttons, single select, and multi-select.
- [ ] Show current saved JSON for debugging.
- [ ] Add buttons for reset, clear storage, and manual save.
- [ ] Make the demo easy to build and run locally.

## Phase 7: Packaging and publishing

- [ ] Decide package name.
- [ ] Decide package manager (`npm`, `pnpm`, or `yarn`).
- [ ] Add final build configuration.
- [ ] Add `exports` / `types` fields for package consumers.
- [ ] Add linting / formatting if desired.
- [ ] Add GitHub Actions CI if desired.
- [ ] Add release notes / changelog.

## Open questions

1. Which Next.js and React versions should be considered the main target?
2. Should the React module support the old jQuery storage format, or is a new cleaner storage format acceptable?
3. Should two different forms with the same `storageKey` restore only their own known fields, or should they also expose unknown saved fields in React state?
4. Is URL hash support still needed for the React version, or can it be postponed indefinitely?
5. Which package manager should the repository standardize on?
