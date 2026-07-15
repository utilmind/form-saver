import type { FormSaverValue, FormSaverValuesConstraint } from './types'

export const areFormSaverValuesEqual = (
    first: FormSaverValue | undefined,
    second: FormSaverValue | undefined
): boolean => {
    if (!Array.isArray(first) || !Array.isArray(second)) {
        return Object.is(first, second)
    }

    if (first.length !== second.length) {
        return false
    }

    for (let index = 0; index < first.length; ++index) {
        if (!Object.is(first[index], second[index])) {
            return false
        }
    }

    return true
}

export const haveFormSaverValuesChanged = <TValues extends FormSaverValuesConstraint<TValues>>(
    values: Partial<TValues>,
    previousValues: Partial<TValues> | undefined
): boolean => {
    if (!previousValues) {
        return true
    }

    for (const key in values) {
        if (!areFormSaverValuesEqual(values[key], previousValues[key])) {
            return true
        }
    }

    return false
}

export const areFormSaverValueMapsEqual = <TValues extends FormSaverValuesConstraint<TValues>>(
    first: Partial<TValues>,
    second: Partial<TValues>
): boolean =>
    !haveFormSaverValuesChanged(first, second) && !haveFormSaverValuesChanged(second, first)
