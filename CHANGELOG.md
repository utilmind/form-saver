# Changelog

All notable changes to this project will be documented in this file.

## [2026-07-15]: React URL hash synchronization

### Added

- Added shared `saveEvent: 'change' | 'input'` behavior to controlled binders and DOM scopes. Text inputs and textareas now save on blur/change by default instead of persisting every keypress.
- Added `autosaveIntervalSeconds`, defaulting to 30 seconds, to periodically save a dirty focused text control without resetting the timer on every keypress. Set it to `0` to disable periodic autosave.
- Added exported defaults for debounce, save event, and focused-control autosave interval.
- Added optional readable URL hash synchronization to the controlled `useFormSaver` API through `urlHash: true`.
- Added deterministic restore priority where a recognized URL hash overrides browser storage without mixing stale local values.
- Added readable repeated hash parameters for array values and runtime type restoration based on `initialValues` or binder defaults.
- Added `clearUrlHashValues()` and configurable `restore` / `historyMode` URL hash options.
- Added automatic `urlHash` support to `useFormSaverDom` and `FormSaverScope` with the same hash-first/storage-fallback behavior as controlled forms.
- Added `restoreUrlHashFromStorage()` as both a hook helper and a standalone utility for route setups that keep form components mounted.
- Enabled URL hash synchronization in all three `react/demo` form examples.
- Added URL hash unit and hook integration tests.
- Added synchronous `beforeunload` flushing for pending controlled-form changes.
- Added focused-field reload recovery for controlled, DOM-hook, and scope APIs, matching the legacy jQuery behavior without weakening shared-hash priority.

### Changed

- Avoided duplicate browser-storage writes when the prepared values are identical to the values already stored.
- Updated the demo to use the lightweight default change/blur persistence mode instead of forcing DOM save-on-input.
- Reused one prepared value set for browser storage and URL hash persistence so `mapBeforeSave` runs only once per save.
- Changed the demo navigation to use clean destination URLs and rely on FormSaver initialization, rather than demo-specific localStorage-to-hash serialization.
- Preserved merged values from shared storage keys when multiple FormSaver scopes synchronize one hash.
- Updated the React and repository documentation with URL hash usage, page-navigation behavior, and restore semantics.
- Fixed URL hash parsing so string values preserve their original case and explicit empty strings remain empty strings.
- Fixed focused-field F5 recovery when multiple FormSaver instances share one `storageKey`; unload saves are now coordinated before the final reload marker is written.
- Stopped rewriting the URL hash during `beforeunload`; the latest value is saved to storage and the hash is rebuilt after initialization, avoiding a visible new-hash → stale-hash → restored-hash sequence on F5.
- Made Vitest startup compatible with Node 25+ by disabling Node's built-in Web Storage only for test workers, preventing it from shadowing jsdom `localStorage`/`sessionStorage`.

## [2026-05-11]: Migration from jQuery to React

### Added

- Added the React + TypeScript FormSaver implementation under `react/`.
- Added SSR-safe storage helpers for `localStorage` and `sessionStorage`.
- Added `useFormSaver` with typed state helpers and form control binders.
- Added the first DOM auto-binding phase with native control helpers and `useFormSaverDom` for uncontrolled forms/containers.
- Added a Vite demo application under `react/demo/`.
- Added three demo tabs covering controlled bind helpers, direct `useFormSaverDom`, and `FormSaverScope asChild`.
- Added URL query parameter synchronization for the active demo tab through `?demo=controlled-bind`, `?demo=dom-hook`, and `?demo=scope-component`.
- Added Vitest unit tests for storage helpers, JSON envelope validation, merge behavior, key removal, prefix cleanup, SSR-safe storage behavior, DOM control collection/restoration helpers, React hook behavior, bind helpers, and SSR render safety.
- Added ESLint and Prettier configuration for the React module.
- Added GitHub Actions CI for React module checks and Vite demo build.
- Added `FormSaverScope` and DOM auto-binding documentation for lightweight uncontrolled native control usage.
- Added jsdom-based React hook tests for `useFormSaver` and `useFormSaverDom`.
- Added clearer documentation for controlled vs uncontrolled React controls.
- Made `useFormSaver` `initialValues` optional for simple bind-only controlled forms.
- Added safe controlled-state value helpers: `getValue`, `getString`, `getBoolean`, and `getArray`.

### Changed

- Updated the repository README to describe both the new React module and the preserved legacy jQuery plugin.
- Documented that the React storage format is independent from the legacy jQuery storage format.
- Marked the React package as side-effect-free to improve production tree-shaking of unused exports.
- Decided that dynamic DOM controls should use explicit `restoreNow()` in the MVP instead of a built-in `MutationObserver`.
- Decided that the public brand is FormSaver, while the package keeps a lowercase npm-compatible name.

### Notes

- The React module is not published to npm yet.
- GitHub Actions CI is used only for automated checks. It does not deploy the project and does not publish anything to npm.
