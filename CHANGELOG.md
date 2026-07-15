# Changelog

All notable changes to this project will be documented in this file.

## [2026-07-15]: React URL hash synchronization

### Added

- Added optional readable URL hash synchronization to the controlled `useFormSaver` API through `urlHash: true`.
- Added deterministic restore priority where a recognized URL hash overrides browser storage without mixing stale local values.
- Added readable repeated hash parameters for array values and runtime type restoration based on `initialValues` or binder defaults.
- Added `clearUrlHashValues()` and configurable `restore` / `historyMode` URL hash options.
- Enabled URL hash synchronization in the `react/demo` controlled-bind example.
- Added URL hash unit and hook integration tests.

### Changed

- Reused one prepared value set for browser storage and URL hash persistence so `mapBeforeSave` runs only once per save.
- Updated the React and repository documentation with URL hash usage and restore semantics.

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
