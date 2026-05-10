/**
 * Hook-level tests for the DOM auto-binding API.
 *
 * These tests render small uncontrolled forms in jsdom to verify the behavior
 * that cannot be covered by pure domControls unit tests: mount restore,
 * event-driven saving, reset/clear helpers, and beforeunload flushing.
 */

// @vitest-environment jsdom

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { readStoredForm, writeStoredForm } from '../src/storage'
import { useFormSaverDom } from '../src/useFormSaverDom'

const STORAGE_KEY = 'use-form-saver-dom-test'

const getInput = (container: HTMLElement, name: string): HTMLInputElement => {
    const input = container.querySelector<HTMLInputElement>(`input[name="${name}"]`)

    if (!input) {
        throw new Error(`Missing input: ${name}`)
    }

    return input
}

const getTextarea = (container: HTMLElement, name: string): HTMLTextAreaElement => {
    const textarea = container.querySelector<HTMLTextAreaElement>(`textarea[name="${name}"]`)

    if (!textarea) {
        throw new Error(`Missing textarea: ${name}`)
    }

    return textarea
}

const DomDemo = ({
    storageKey = STORAGE_KEY,
    saveEvent = 'change',
    debounceMs = 0,
    onSave
}: {
    storageKey?: string
    saveEvent?: 'change' | 'input'
    debounceMs?: number
    onSave?: () => void
}) => {
    const formSaver = useFormSaverDom<HTMLFormElement>({
        storageKey,
        saveEvent,
        debounceMs,
        onSave
    })

    return (
        <div>
            <form ref={formSaver.ref}>
                <input name="title" defaultValue="Default title" />
                <textarea name="notes" defaultValue="Default notes" />
                <input name="enabled" type="checkbox" defaultChecked={false} />
            </form>

            <button type="button" onClick={() => formSaver.saveNow()}>
                save
            </button>
            <button type="button" onClick={() => formSaver.resetValues()}>
                reset
            </button>
            <button type="button" onClick={() => formSaver.clearStoredValues()}>
                clear
            </button>
            <output data-testid="restored">{formSaver.hasRestored ? 'yes' : 'no'}</output>
        </div>
    )
}

beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
})

afterEach(() => {
    cleanup()
})
describe('useFormSaverDom', () => {
    it('restores stored values after mount', async () => {
        writeStoredForm(
            STORAGE_KEY,
            {
                title: 'Restored title',
                notes: 'Restored notes',
                enabled: true
            },
            {
                now: () => 111
            }
        )

        const { container, getByTestId } = render(<DomDemo />)

        await waitFor(() => {
            expect(getInput(container, 'title').value).toBe('Restored title')
        })

        expect(getTextarea(container, 'notes').value).toBe('Restored notes')
        expect(getInput(container, 'enabled').checked).toBe(true)
        expect(getByTestId('restored').textContent).toBe('yes')
    })

    it('saves native control values after a change event', async () => {
        const onSave = vi.fn()
        const { container } = render(<DomDemo onSave={onSave} />)
        const title = getInput(container, 'title')

        fireEvent.change(title, { target: { value: 'Changed title' } })

        await waitFor(() => {
            expect(readStoredForm(STORAGE_KEY)?.values.title).toBe('Changed title')
        })
        expect(onSave).toHaveBeenCalled()
    })

    it('flushes unsaved input changes on beforeunload', async () => {
        const { container } = render(<DomDemo debounceMs={5000} saveEvent="input" />)
        const title = getInput(container, 'title')

        fireEvent.input(title, { target: { value: 'Typed but not blurred' } })
        expect(readStoredForm(STORAGE_KEY)).toBeNull()

        window.dispatchEvent(new Event('beforeunload'))

        await waitFor(() => {
            expect(readStoredForm(STORAGE_KEY)?.values.title).toBe('Typed but not blurred')
        })
    })

    it('resets native controls to defaults and saves the reset values', async () => {
        const { container, getByText } = render(<DomDemo />)
        const title = getInput(container, 'title')
        const enabled = getInput(container, 'enabled')

        fireEvent.change(title, { target: { value: 'Changed title' } })
        fireEvent.click(enabled)
        fireEvent.click(getByText('reset'))

        await waitFor(() => {
            expect(readStoredForm(STORAGE_KEY)?.values.title).toBe('Default title')
        })
        expect(title.value).toBe('Default title')
        expect(enabled.checked).toBe(false)
        expect(readStoredForm(STORAGE_KEY)?.values.enabled).toBe(false)
    })

    it('clears stored DOM values without changing current controls', async () => {
        const { container, getByText } = render(<DomDemo />)
        const title = getInput(container, 'title')

        fireEvent.change(title, { target: { value: 'Saved title' } })

        await waitFor(() => {
            expect(readStoredForm(STORAGE_KEY)).not.toBeNull()
        })

        fireEvent.click(getByText('clear'))

        expect(readStoredForm(STORAGE_KEY)).toBeNull()
        expect(title.value).toBe('Saved title')
    })
})
