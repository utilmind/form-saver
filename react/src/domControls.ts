/**
 * Native DOM control helpers for the DOM-based FormSaver API.
 *
 * These functions intentionally work with real browser controls rather than
 * React state. They are used by useFormSaverDom and are best suited for
 * uncontrolled native inputs, textareas, and selects.
 */

import type { FormSaverValue, FormSaverValues } from './types'

export const DEFAULT_DOM_CONTROL_SELECTOR = 'input[name], textarea[name], select[name]'
export const DEFAULT_DOM_IGNORE_SELECTOR = '[data-form-saver-ignore], .no-save'

const UNSUPPORTED_INPUT_TYPES = {
    button: true,
    file: true,
    image: true,
    reset: true,
    submit: true
} as const

export interface DomControlOptions {
    /** Include password fields in saved values. Disabled by default for safety. */
    includePasswords?: boolean

    /** CSS selector used to discover native controls inside the root element. */
    controlSelector?: string

    /** CSS selector for controls or ancestors that must be ignored. */
    ignoreSelector?: string
}

type SupportedControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

const isInput = (control: SupportedControl): control is HTMLInputElement =>
    control.tagName === 'INPUT'

const isTextArea = (control: SupportedControl): control is HTMLTextAreaElement =>
    control.tagName === 'TEXTAREA'

const isSelect = (control: SupportedControl): control is HTMLSelectElement =>
    control.tagName === 'SELECT'

const getInputType = (input: HTMLInputElement): string => input.type.toLowerCase()

const isUnsupportedInput = (input: HTMLInputElement, includePasswords: boolean): boolean => {
    const type = getInputType(input)

    return type in UNSUPPORTED_INPUT_TYPES || (!includePasswords && type === 'password')
}

const isIgnored = (control: SupportedControl, ignoreSelector: string): boolean =>
    Boolean(ignoreSelector) &&
    (control.matches(ignoreSelector) || Boolean(control.closest(ignoreSelector)))

const isSupportedControl = (
    element: Element,
    includePasswords: boolean,
    ignoreSelector: string
): element is SupportedControl => {
    if (
        !(element instanceof HTMLInputElement) &&
        !(element instanceof HTMLTextAreaElement) &&
        !(element instanceof HTMLSelectElement)
    ) {
        return false
    }

    if (!element.name || isIgnored(element, ignoreSelector)) {
        return false
    }

    return !(element instanceof HTMLInputElement) || !isUnsupportedInput(element, includePasswords)
}

export const getDomFormControls = (
    root: ParentNode,
    options: DomControlOptions = {}
): SupportedControl[] => {
    const controlSelector = options.controlSelector ?? DEFAULT_DOM_CONTROL_SELECTOR
    const ignoreSelector = options.ignoreSelector ?? DEFAULT_DOM_IGNORE_SELECTOR
    const includePasswords = options.includePasswords ?? false
    const result: SupportedControl[] = []
    const controls = root.querySelectorAll(controlSelector)

    for (let i = 0; i < controls.length; ++i) {
        const control = controls[i]
        if (isSupportedControl(control, includePasswords, ignoreSelector)) {
            result.push(control)
        }
    }

    return result
}

const getSelectedOptionValues = (select: HTMLSelectElement): string[] => {
    const values: string[] = []

    for (let i = 0; i < select.options.length; ++i) {
        const option = select.options[i]
        if (option.selected) {
            values.push(option.value)
        }
    }

    return values
}

const toStringArray = (value: FormSaverValue | undefined): string[] => {
    if (!Array.isArray(value)) {
        return value === undefined || value === null ? [] : [String(value)]
    }

    const result: string[] = []
    for (let i = 0; i < value.length; ++i) {
        const item = value[i]
        if (item !== null) {
            result.push(String(item))
        }
    }

    return result
}

const collectCheckboxValue = (checkboxes: HTMLInputElement[]): boolean | string[] => {
    if (checkboxes.length === 1) {
        return checkboxes[0].checked
    }

    const values: string[] = []
    for (let i = 0; i < checkboxes.length; ++i) {
        const checkbox = checkboxes[i]
        if (checkbox.checked) {
            values.push(checkbox.value)
        }
    }

    return values
}

const collectRadioValue = (radios: HTMLInputElement[]): string | undefined => {
    for (let i = 0; i < radios.length; ++i) {
        const radio = radios[i]
        if (radio.checked) {
            return radio.value
        }
    }

    return undefined
}

const collectControlGroupValue = (controls: SupportedControl[]): FormSaverValue | undefined => {
    const firstControl = controls[0]

    if (isInput(firstControl)) {
        const type = getInputType(firstControl)

        if (type === 'checkbox') {
            return collectCheckboxValue(controls as HTMLInputElement[])
        }

        if (type === 'radio') {
            return collectRadioValue(controls as HTMLInputElement[])
        }

        return firstControl.value
    }

    if (isTextArea(firstControl)) {
        return firstControl.value
    }

    if (isSelect(firstControl)) {
        return firstControl.multiple ? getSelectedOptionValues(firstControl) : firstControl.value
    }

    return undefined
}

// Collects values from all supported named native controls inside root.
export const collectDomFormValues = (
    root: ParentNode,
    options: DomControlOptions = {}
): FormSaverValues => {
    const controls = getDomFormControls(root, options)
    const groups: Record<string, SupportedControl[] | undefined> = {}
    const values: FormSaverValues = {}

    for (let i = 0; i < controls.length; ++i) {
        const control = controls[i]
        const group = groups[control.name]

        if (group) {
            group.push(control)
        } else {
            groups[control.name] = [control]
        }
    }

    for (const name in groups) {
        const group = groups[name]
        if (group !== undefined) {
            values[name] = collectControlGroupValue(group)
        }
    }

    return values
}

const restoreCheckboxValue = (
    checkboxes: HTMLInputElement[],
    value: FormSaverValue | undefined
) => {
    if (checkboxes.length === 1) {
        checkboxes[0].checked = Boolean(value)
        return
    }

    const selectedValues = toStringArray(value)
    for (let i = 0; i < checkboxes.length; ++i) {
        const checkbox = checkboxes[i]
        checkbox.checked = selectedValues.indexOf(checkbox.value) !== -1
    }
}

const restoreRadioValue = (radios: HTMLInputElement[], value: FormSaverValue | undefined) => {
    const stringValue = value === undefined || value === null ? '' : String(value)

    for (let i = 0; i < radios.length; ++i) {
        const radio = radios[i]
        radio.checked = stringValue !== '' && radio.value === stringValue
    }
}

const restoreSelectValue = (select: HTMLSelectElement, value: FormSaverValue | undefined) => {
    if (!select.multiple) {
        select.value = value === undefined || value === null ? '' : String(value)
        return
    }

    const selectedValues = toStringArray(value)
    for (let i = 0; i < select.options.length; ++i) {
        const option = select.options[i]
        option.selected = selectedValues.indexOf(option.value) !== -1
    }
}

const restoreControlGroupValue = (
    controls: SupportedControl[],
    value: FormSaverValue | undefined
): void => {
    const firstControl = controls[0]

    if (isInput(firstControl)) {
        const type = getInputType(firstControl)

        if (type === 'checkbox') {
            restoreCheckboxValue(controls as HTMLInputElement[], value)
            return
        }

        if (type === 'radio') {
            restoreRadioValue(controls as HTMLInputElement[], value)
            return
        }

        firstControl.value = value === undefined || value === null ? '' : String(value)
        return
    }

    if (isTextArea(firstControl)) {
        firstControl.value = value === undefined || value === null ? '' : String(value)
        return
    }

    if (isSelect(firstControl)) {
        restoreSelectValue(firstControl, value)
    }
}

// Restores only values that are present in the provided object.
export const restoreDomFormValues = (
    root: ParentNode,
    values: Partial<FormSaverValues>,
    options: DomControlOptions = {}
): void => {
    const controls = getDomFormControls(root, options)
    const groups: Record<string, SupportedControl[] | undefined> = {}

    for (let i = 0; i < controls.length; ++i) {
        const control = controls[i]
        const group = groups[control.name]

        if (group) {
            group.push(control)
        } else {
            groups[control.name] = [control]
        }
    }

    for (const name in values) {
        const group = groups[name]
        if (group !== undefined) {
            restoreControlGroupValue(group, values[name])
        }
    }
}

const resetSelectToDefault = (select: HTMLSelectElement): void => {
    let hasDefaultSelected = false

    for (let i = 0; i < select.options.length; ++i) {
        const option = select.options[i]
        option.selected = option.defaultSelected
        hasDefaultSelected = hasDefaultSelected || option.defaultSelected
    }

    if (!select.multiple && !hasDefaultSelected && select.options.length > 0) {
        select.options[0].selected = true
    }
}

const resetControlToDefault = (control: SupportedControl): void => {
    if (isInput(control)) {
        const type = getInputType(control)
        if (type === 'checkbox' || type === 'radio') {
            control.checked = control.defaultChecked
        } else {
            control.value = control.defaultValue
        }
        return
    }

    if (isTextArea(control)) {
        control.value = control.defaultValue
        return
    }

    if (isSelect(control)) {
        resetSelectToDefault(control)
    }
}

// Resets supported controls to their native default values.
export const resetDomFormValues = (root: HTMLElement, options: DomControlOptions = {}): void => {
    if (root instanceof HTMLFormElement) {
        root.reset()
        return
    }

    const controls = getDomFormControls(root, options)
    for (let i = 0; i < controls.length; ++i) {
        resetControlToDefault(controls[i])
    }
}
