/**
 * Shared focused-control autosave support for controlled and DOM APIs.
 *
 * A timer starts after the first unsaved text edit and is not restarted by
 * every keypress. This allows long-running edits to be persisted periodically
 * without writing storage continuously. A successful regular save cancels the
 * pending autosave timer.
 */

import { useCallback, useEffect, useRef } from 'react'

interface UseFocusedControlAutosaveOptions {
    enabled: boolean
    intervalSeconds: number
    isDirty: () => boolean
    save: () => void
}

interface FocusedControlAutosaveResult {
    schedule: (control: Element | null) => void
    cancel: () => void
}

const TEXT_INPUT_TYPES = new Set([
    'date',
    'datetime-local',
    'email',
    'month',
    'number',
    'password',
    'search',
    'tel',
    'text',
    'time',
    'url',
    'week'
])

export const isTextEditingControl = (control: Element | null): boolean => {
    if (control instanceof HTMLTextAreaElement) {
        return true
    }

    return control instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(control.type.toLowerCase())
}

export const useFocusedControlAutosave = ({
    enabled,
    intervalSeconds,
    isDirty,
    save
}: UseFocusedControlAutosaveOptions): FocusedControlAutosaveResult => {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const controlRef = useRef<Element | null>(null)
    const isDirtyRef = useRef(isDirty)
    const saveRef = useRef(save)

    isDirtyRef.current = isDirty
    saveRef.current = save

    const cancel = useCallback((): void => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current)
            timerRef.current = null
        }

        controlRef.current = null
    }, [])

    const schedule = useCallback(
        (control: Element | null): void => {
            if (
                !enabled ||
                !Number.isFinite(intervalSeconds) ||
                intervalSeconds <= 0 ||
                !isTextEditingControl(control)
            ) {
                return
            }

            if (timerRef.current !== null && controlRef.current === control) {
                return
            }

            cancel()
            controlRef.current = control
            timerRef.current = setTimeout(() => {
                timerRef.current = null
                const scheduledControl = controlRef.current
                controlRef.current = null

                if (
                    !scheduledControl ||
                    typeof document === 'undefined' ||
                    document.activeElement !== scheduledControl ||
                    !isDirtyRef.current()
                ) {
                    return
                }

                saveRef.current()
            }, intervalSeconds * 1000)
        },
        [cancel, enabled, intervalSeconds]
    )

    useEffect(() => cancel, [cancel])

    return {
        schedule,
        cancel
    }
}
