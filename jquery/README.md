# FormSaver

FormSaver is a small jQuery plugin (ES5-era) for **saving and restoring
unsubmitted form content** in the browser using `localStorage`,
`sessionStorage`, and/or the URL hash.

It is designed for classic jQuery-based applications that need auto-save
/ auto-restore of long forms without introducing a modern framework.

> ⚠️ This plugin targets legacy jQuery / ES5 codebases. It is
> intentionally not written in modern ES6+ style.

------------------------------------------------------------------------

## Features

-   Automatically saves form fields to `localStorage` (or
    `sessionStorage`) as the user types.
-   Restores form content on page load, including:
    -   text inputs, textareas, selects (including `<select multiple>`)
    -   checkboxes and radio groups, with smart handling of default
        states
-   Optional mirroring of all saved values into the URL hash for deep
    links / sharable states.
-   Custom logic for choosing between **hash vs storage** on restore
    (including page-refresh detection).
-   Per-field value transformation via `data('load', fn)` handlers.
-   Supports [Twitter Typeahead](https://github.com/twitter/typeahead.js/) inputs (via `.typeahead('val', ...)`) out
    of the box.
-   Extra jQuery utilities for:
    -   **partial form reset** (reset only a block instead of entire
        form)
    -   **"check all / uncheck all"** checkbox handling
-   Global helper functions for managing stored data across the site.

------------------------------------------------------------------------

## Requirements

-   [**jQuery**](https://github.com/jquery/jquery) (any reasonably modern 1.x/2.x/3.x with `.on`, `.data`,
    etc.)
-   Optional:
    -   [Twitter Typeahead](https://github.com/twitter/typeahead.js/) — only if you use its `.tt-input` fields.
    -   Your own "commons" utilities (e.g. `$.fn.resetForm`), if
        present.

The plugin is written in plain ES5 and does not require any bundler or
build step.

------------------------------------------------------------------------

## Installation

``` html
<script src="jquery.min.js"></script>
<script src="form-saver.js"></script>
```

------------------------------------------------------------------------

## Basic usage

``` html
<form id="contact-form"></form>

<script>
  $('#contact-form')
    .on('restore', function (e, storedTimestamp) {
      if ((Date.now() - storedTimestamp) / 1000 > 5 && window.alertify) {
        alertify.success(
          'Form content has been restored. Click "Reset form" if you want to start from scratch.',
          10
        );
      }
    })
    .on('reset', function () {})
    .initFormSaver({ storageKey: 'contact-form' });
</script>
```

* Only fields with a `name` attribute are saved.
* This example uses [AlertifyJS](https://github.com/MohammadYounes/AlertifyJS)

------------------------------------------------------------------------

## jQuery API

### `$(form).initFormSaver(options)`

Main entry point. All options are optional:

    {
      storageKey: "form",
      noUseStorage: 0,
      noUseHash: 0,
      keep1stHash: 0,
      storePasswords: 0,
      keyField: null,
      onLoadStorage: function (storedData) { return storedData; },
      load: true,
      reset: false
    }

(Additional detailed documentation omitted here due to length; it's
included in earlier output.)

------------------------------------------------------------------------

## Examples

Example pages will be added later:

-   `examples/basic.html`
-   `examples/hash-only.html`
-   `examples/session-storage.html`
-   `examples/advanced.html`

