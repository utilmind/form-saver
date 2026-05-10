/**
 * Shared runtime defaults for the public React APIs.
 *
 * Keep these values small and explicit so README examples, hooks, and tests can
 * reference the same behavior without duplicating magic numbers.
 */

import type { FormSaverDomSaveEvent } from './types'

export const DEFAULT_FORM_SAVER_DEBOUNCE_MS = 150
export const DEFAULT_FORM_SAVER_DOM_SAVE_EVENT: FormSaverDomSaveEvent = 'change'
