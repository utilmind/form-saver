# FormSaver

FormSaver is a small form/settings persistence toolkit.

The repository contains two implementations:

- `react/` — a small React hook package for saving and restoring controlled form state in modern React applications, including Next.js. Its main public API is the custom `useFormSaver` hook; it is not a UI component and it does not render markup.
- `jquery/` — the legacy jQuery / ES5 plugin kept for existing PHP + Bootstrap + jQuery projects.

The React hook package is the current direction of the project. The jQuery plugin is preserved as-is for backward compatibility.

## Current status

The React migration is in progress.

See [`TODO-migration-to-react.md`](./TODO-migration-to-react.md) for the full migration checklist.
See [`CHANGELOG.md`](./CHANGELOG.md) for release notes.

## React hook package

The code in `react/` is a reusable React hook package. It is designed around controlled form state:

- restore saved values from `localStorage` or `sessionStorage` after client-side mount;
- save values automatically when settings change;
- work safely in Next.js without touching browser storage during server-side rendering;
- preserve unknown stored fields when several related forms share the same `storageKey`;
- store all React values as one readable JSON envelope per `storageKey`;
- provide typed helpers for common controls: text inputs, textarea, checkbox, radio, select, and multi-select.

Basic example:

```tsx
import { useFormSaver } from "./react/src";

type SettingsForm = {
  search: string;
  enabled: boolean;
  mode: "simple" | "advanced";
  category: string;
  tags: string[];
  notes: string;
};

const initialValues: SettingsForm = {
  search: "",
  enabled: false,
  mode: "simple",
  category: "",
  tags: [],
  notes: "",
};

export function SettingsPage() {
  const form = useFormSaver<SettingsForm>({
    storageKey: "settings-form",
    initialValues,
    urlHash: true,
  });

  return (
    <form>
      <input {...form.bind.text("search")} />
      <label>
        <input type="checkbox" {...form.bind.checkbox("enabled")} />
        Enabled
      </label>
      <textarea {...form.bind.textarea("notes")} />
    </form>
  );
}
```

See [`react/README.md`](./react/README.md) for the React package API draft.

The React storage format is intentionally independent from the legacy jQuery plugin storage format.

React package checks:

```bash
cd react
npm install
npm run format:check
npm run lint
npm run test:run
npm run typecheck
npm run build
```

The repository also includes a GitHub Actions workflow at `.github/workflows/react-ci.yml`.
It runs the same React checks automatically on pushes and pull requests, and also builds the Vite demo app.

## Demo app

A small Vite demo is available under `react/demo/` for manual testing of the React hook package. It has three tabs covering controlled bind helpers, direct `useFormSaverDom`, and `FormSaverScope asChild`.

```bash
cd react/demo
npm install
npm run dev
```

Or, after installing the demo dependencies, from `react/`:

```bash
npm run demo:dev
```

## Legacy jQuery plugin

The old jQuery plugin remains under `jquery/`.

It supports classic ES5-era projects and can save/restore form fields with `localStorage`, `sessionStorage`, and optional URL hash synchronization. The React package now also supports URL hash synchronization through `useFormSaver({ urlHash: true })`.

See [`jquery/README.md`](./jquery/README.md) for legacy usage.

## License

See [`LICENSE.txt`](./LICENSE.txt).
