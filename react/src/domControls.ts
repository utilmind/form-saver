/**
 * Native DOM control helpers for the DOM-based FormSaver API.
 *
 * These functions intentionally work with real browser controls rather than
 * React state. They are used by useFormSaverDom and are best suited for
 * uncontrolled native inputs, textareas, and selects.
 */

import type { FormSaverValue, FormSaverValues } from './types'

const DEF_DOM_CONTROL_SELECTOR = 'input[name], textarea[name], select[name]'
const DEF_DOM_IGNORE_SELECTOR = '[data-form-saver-ignore], .no-save'

export interface DomControlOptions {
    /** Include password fields in saved values. Disabled by default for safety. */
    includePasswords?: boolean

    /** CSS selector used to discover native controls inside the root element. */
    controlSelector?: string

    /** CSS selector for controls or ancestors that must be ignored. */
    ignoreSelector?: string
}

type SupportedControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

export const getDomFormControls = (
    root: HTMLElement,
    options: DomControlOptions = {}
): SupportedControl[] => {
    const controlSelector = options.controlSelector || DEF_DOM_CONTROL_SELECTOR
    const ignoreSelector = options.ignoreSelector || DEF_DOM_IGNORE_SELECTOR
    const elements = root.querySelectorAll(controlSelector)
    const result: SupportedControl[] = []
    const len = elements.length

    for (let i = 0; i < len; ++i) {
        const ctrl = elements[i] as SupportedControl
        const name = ctrl.name

        if (
            // Nameless elements are invalid for our purposes.
            name &&
            (!ignoreSelector || !ctrl.matches(ignoreSelector))
        ) {
            const tag = ctrl.tagName
            if (tag === 'INPUT') {
                const input = ctrl as HTMLInputElement
                const type = input.type // Browser already returns normalized lowercase type.

                if (
                    // Don't save values for these input types, which are either non-data or potentially sensitive. This also helps avoid accidentally saving large data blobs from file inputs.
                    ['button', 'file', 'image', 'reset', 'submit'].indexOf(type) === -1 &&
                    // We don't want to store entered passwords either, but maybe there can be some exceptions for non-sensitive data, so we allow including them via options.
                    (type !== 'password' || options.includePasswords)
                ) {
                    result.push(input)
                }
            } else if (tag === 'TEXTAREA' || tag === 'SELECT') {
                result.push(ctrl)
            }
        }
    }

    return result
}

export const collectDomFormValues = (
    root: HTMLElement,
    options: DomControlOptions = {}
): FormSaverValues => {
    const controls = getDomFormControls(root, options)
    const values: FormSaverValues = {}
    const len = controls.length

    for (let i = 0; i < len; ++i) {
        const ctrl = controls[i]
        const name = ctrl.name
        const tag = ctrl.tagName

        if (tag === 'INPUT') {
            const input = ctrl as HTMLInputElement
            const type = input.type
            if (type === 'checkbox') {
                values[name] = input.checked
            } else if (type === 'radio') {
                if (input.checked) {
                    values[name] = input.value
                } else if (values[name] === undefined) {
                    values[name] = null
                }
            } else {
                values[name] = input.value
            }
        } else if (tag === 'TEXTAREA') {
            values[name] = (ctrl as HTMLTextAreaElement).value
        } else if (tag === 'SELECT') {
            const select = ctrl as HTMLSelectElement
            if (select.multiple) {
                const selected: string[] = []
                const opts = select.options
                for (let j = 0; j < opts.length; ++j) {
                    const opt = opts[j]
                    if (opt.selected) {
                        selected.push(opt.value)
                    }
                }
                values[name] = selected
            } else {
                values[name] = select.value
            }
        }
    }

    return values
}

const restoreControlValue = (control: SupportedControl, value: FormSaverValue): void => {
    const tag = control.tagName
    if (tag === 'INPUT') {
        const input = control as HTMLInputElement
        const type = input.type
        if (type === 'checkbox') {
            input.checked = Boolean(value)
        } else if (type === 'radio') {
            input.checked = input.value === String(value)
        } else {
            input.value = value === null || value === undefined ? '' : String(value)
        }
    } else if (tag === 'TEXTAREA') {
        ;(control as HTMLTextAreaElement).value =
            value === null || value === undefined ? '' : String(value)
    } else if (tag === 'SELECT') {
        const select = control as HTMLSelectElement
        if (select.multiple && Array.isArray(value)) {
            for (let i = 0; i < select.options.length; ++i) {
                const opt = select.options[i]
                opt.selected = false
                for (let j = 0; j < value.length; ++j) {
                    if (opt.value === String(value[j])) {
                        opt.selected = true
                        break
                    }
                }
            }
        } else {
            select.value = value === null || value === undefined ? '' : String(value)
        }
    }
}

export const restoreDomFormValues = (
    root: HTMLElement,
    values: FormSaverValues,
    options: DomControlOptions = {}
): void => {
    const controls = getDomFormControls(root, options)
    for (let i = 0; i < controls.length; ++i) {
        const ctrl = controls[i]
        const val = values[ctrl.name]
        if (val !== undefined) {
            restoreControlValue(ctrl, val)
        }
    }
}

export const resetDomFormValues = (root: HTMLElement, options: DomControlOptions = {}): void => {
    if (root instanceof HTMLFormElement) {
        root.reset()
        return
    }

    const controls = getDomFormControls(root, options)
    for (let i = 0; i < controls.length; ++i) {
        const ctrl = controls[i]
        const tag = ctrl.tagName

        if (tag === 'INPUT') {
            const input = ctrl as HTMLInputElement
            const type = input.type
            if (type === 'checkbox' || type === 'radio') {
                input.checked = input.defaultChecked
            } else {
                input.value = input.defaultValue
            }
        } else if (tag === 'TEXTAREA') {
            ;(ctrl as HTMLTextAreaElement).value = (ctrl as HTMLTextAreaElement).defaultValue
        } else if (tag === 'SELECT') {
            const select = ctrl as HTMLSelectElement
            let hasDefault = false
            for (let j = 0; j < select.options.length; ++j) {
                const opt = select.options[j]
                opt.selected = opt.defaultSelected
                if (opt.defaultSelected) hasDefault = true
            }
            if (!select.multiple && !hasDefault && select.options.length > 0) {
                select.options[0].selected = true
            }
        }
    }
}
