# Changelog

All notable changes to this project will be documented in this file.

This project is currently in early React migration stage. The legacy jQuery plugin remains available under `jquery/`.

## [2026-02-04]

### Added

- Added the React + TypeScript FormSaver implementation under `react/`.
- Added SSR-safe storage helpers for `localStorage` and `sessionStorage`.
- Added `useFormSaver` with typed state helpers and form control binders.
- Added a Vite demo application under `react/demo/`.
- Added Vitest unit tests for storage helpers, JSON envelope validation, merge behavior, key removal, prefix cleanup, and SSR-safe storage behavior.
- Added ESLint and Prettier configuration for the React module.
- Added GitHub Actions CI for React module checks and Vite demo build.

### Changed

- Updated the repository README to describe both the new React module and the preserved legacy jQuery plugin.
- Documented that the React storage format is independent from the legacy jQuery storage format.

### Notes

- The React module is not published to npm yet.
- GitHub Actions CI is used only for automated checks. It does not deploy the project and does not publish anything to npm.
