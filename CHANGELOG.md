# Changelog

All notable changes to this project will be documented in this file.

This project is currently in early React migration stage. The legacy jQuery plugin remains available under `jquery/`.

## [2026-02-04]

### Added

- Added the React + TypeScript FormSaver implementation under `react/`.
- Added SSR-safe storage helpers for `localStorage` and `sessionStorage`.
- Added `useFormSaver` with typed state helpers and form control binders.
- Added the first DOM auto-binding phase with native control helpers and `useFormSaverDom` for uncontrolled forms/containers.
- Added a Vite demo application under `react/demo/`.
- Added three demo tabs covering controlled bind helpers, direct `useFormSaverDom`, and `FormSaverScope asChild`.
- Added Vitest unit tests for storage helpers, JSON envelope validation, merge behavior, key removal, prefix cleanup, SSR-safe storage behavior, DOM control collection/restoration helpers, React hook behavior, bind helpers, and SSR render safety.
- Added ESLint and Prettier configuration for the React module.
- Added GitHub Actions CI for React module checks and Vite demo build.
- Added `FormSaverScope` and DOM auto-binding documentation for lightweight uncontrolled native control usage.
- Added jsdom-based React hook tests for `useFormSaver` and `useFormSaverDom`.

### Changed

- Updated the repository README to describe both the new React module and the preserved legacy jQuery plugin.
- Documented that the React storage format is independent from the legacy jQuery storage format.
- Marked the React package as side-effect-free to improve production tree-shaking of unused exports.
- Decided that dynamic DOM controls should use explicit `restoreNow()` in the MVP instead of a built-in `MutationObserver`.
- Decided that the public brand is FormSaver, while the package keeps a lowercase npm-compatible name.

### Notes

- The React module is not published to npm yet.
- GitHub Actions CI is used only for automated checks. It does not deploy the project and does not publish anything to npm.
