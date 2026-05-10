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
            (!ignoreSelector || (!ctrl.matches(ignoreSelector) && !ctrl.closest(ignoreSelector)))
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

    // 1: Identify checkbox groups by counting unique elements per name.
    // We use a Set to ensure that if the same element reference appears multiple
    // times in the collection, it doesn't trick the logic into creating an array.
    const checkboxGroups = new Map<string, Set<HTMLInputElement>>()

    for (const ctrl of controls) {
        if (
            ctrl.tagName.toUpperCase() === 'INPUT' &&
            (ctrl as HTMLInputElement).type === 'checkbox'
        ) {
            const name = ctrl.name
            if (!checkboxGroups.has(name)) {
                checkboxGroups.set(name, new Set())
            }

            let group = checkboxGroups.get(name)
            // If the group doesn't exist yet, initialize it
            if (!group) {
                group = new Set<HTMLInputElement>()
                checkboxGroups.set(name, group)
            }
            group.add(ctrl as HTMLInputElement)
        }
    }

    // 2: Collect values from all supported controls.
    for (const ctrl of controls) {
        const name = ctrl.name
        if (!name) continue

        const tag = ctrl.tagName.toUpperCase()

        if (tag === 'INPUT') {
            const input = ctrl as HTMLInputElement
            const type = (input.type || '').toLowerCase()

            if (type === 'checkbox') {
                // A name is treated as a group only if there's more than one unique checkbox element.
                const isGroup = (checkboxGroups.get(name)?.size ?? 0) > 1

                if (isGroup) {
                    if (!Array.isArray(values[name])) {
                        values[name] = []
                    }
                    if (input.checked) {
                        ;(values[name] as string[]).push(input.value)
                    }
                } else {
                    // Single checkbox results in a simple boolean value.
                    values[name] = input.checked
                }
            } else if (type === 'radio') {
                if (input.checked) {
                    values[name] = input.value
                } else if (!(name in values)) {
                    // Initialize radio group with null if no option is checked yet.
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
                const options = select.options
                for (let j = 0; j < options.length; ++j) {
                    if (options[j].selected) {
                        selected.push(options[j].value)
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
            if (Array.isArray(value)) {
                input.checked = value.indexOf(input.value) !== -1
            } else {
                input.checked = Boolean(value)
            }
        } else if (type === 'radio') {
            input.checked = input.value === String(value)
        } else {
            input.value = value === null ? '' : String(value)
        }
    } else if (tag === 'TEXTAREA') {
        ;(control as HTMLTextAreaElement).value = value === null ? '' : String(value)
    } else if (tag === 'SELECT') {
        const select = control as HTMLSelectElement
        if (select.multiple && Array.isArray(value)) {
            const opts = select.options
            const vLen = value.length
            for (let i = 0; i < opts.length; ++i) {
                const opt = opts[i]
                let isSelected = false
                for (let j = 0; j < vLen; ++j) {
                    if (opt.value === String(value[j])) {
                        isSelected = true
                        break
                    }
                }
                opt.selected = isSelected
            }
        } else {
            select.value = value === null ? '' : String(value)
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
        // Only attempt restoration if a value exists in the data set.
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
            const opts = select.options
            let hasDefault = false
            for (let j = 0; j < opts.length; ++j) {
                const opt = opts[j]
                opt.selected = opt.defaultSelected
                if (opt.defaultSelected) hasDefault = true
            }
            if (!select.multiple && !hasDefault && opts.length > 0) {
                opts[0].selected = true
            }
        }
    }
}
