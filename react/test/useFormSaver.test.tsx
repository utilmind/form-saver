/**
 * Hook-level tests for the controlled React state API.
 *
 * The pure storage tests cover persistence details. These tests verify that the
 * public hook restores after mount, binds native controls, saves after changes,
 * and exposes reset/clear helpers as expected by React consumers.
 */

// @vitest-environment jsdom

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { readStoredForm, writeStoredForm } from '../src/storage'
import { useFormSaver } from '../src/useFormSaver'

interface SettingsFormValues {
    title: string
    enabled: boolean
    mode: string
    tags: string[]
    notes: string
}

const STORAGE_KEY = 'use-form-saver-controlled-test'
const INITIAL_VALUES: SettingsFormValues = {
    title: 'Default title',
    enabled: false,
    mode: 'fast',
    tags: [],
    notes: 'Default notes'
}

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

const getSelect = (container: HTMLElement, name: string): HTMLSelectElement => {
    const select = container.querySelector<HTMLSelectElement>(`select[name="${name}"]`)

    if (!select) {
        throw new Error(`Missing select: ${name}`)
    }

    return select
}

const ControlledDemo = () => {
    const formSaver = useFormSaver<SettingsFormValues>({
        storageKey: STORAGE_KEY,
        initialValues: INITIAL_VALUES,
        debounceMs: 0
    })

    return (
        <form>
            <input {...formSaver.bind.text('title')} />
            <textarea {...formSaver.bind.textarea('notes')} />
            <input type="checkbox" {...formSaver.bind.checkbox('enabled')} />

            <label>
                <input type="radio" {...formSaver.bind.radio('mode', 'fast')} />
                Fast
            </label>
            <label>
                <input type="radio" {...formSaver.bind.radio('mode', 'accurate')} />
                Accurate
            </label>

            <select {...formSaver.bind.multiSelect('tags')}>
                <option value="a">A</option>
                <option value="b">B</option>
            </select>

            <button type="button" onClick={() => formSaver.resetValues()}>
                reset
            </button>
            <button type="button" onClick={() => formSaver.clearStoredValues()}>
                clear
            </button>
            <button type="button" onClick={() => formSaver.saveNow()}>
                save
            </button>
            <output data-testid="restored">{formSaver.hasRestored ? 'yes' : 'no'}</output>
        </form>
    )
}

beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
})

afterEach(() => {
    cleanup()
})
describe('useFormSaver', () => {
    it('restores known controlled values after mount', async () => {
        writeStoredForm<SettingsFormValues>(STORAGE_KEY, {
            title: 'Restored title',
            enabled: true,
            mode: 'accurate',
            tags: ['a'],
            notes: 'Restored notes'
        })

        const { container, getByTestId } = render(<ControlledDemo />)

        await waitFor(() => {
            expect(getInput(container, 'title').value).toBe('Restored title')
        })

        expect(getInput(container, 'enabled').checked).toBe(true)
        expect(getInput(container, 'mode').checked).toBe(false)
        expect(container.querySelectorAll<HTMLInputElement>('input[name="mode"]')[1].checked).toBe(
            true
        )
        expect(getSelect(container, 'tags').selectedOptions[0].value).toBe('a')
        expect(getTextarea(container, 'notes').value).toBe('Restored notes')
        expect(getByTestId('restored').textContent).toBe('yes')
    })

    it('saves values changed through bind helpers', async () => {
        const { container } = render(<ControlledDemo />)

        fireEvent.change(getInput(container, 'title'), { target: { value: 'Changed title' } })
        fireEvent.click(getInput(container, 'enabled'))
        const tags = getSelect(container, 'tags')
        tags.options[0].selected = true
        tags.options[1].selected = true
        fireEvent.change(tags)

        await waitFor(() => {
            expect(readStoredForm<SettingsFormValues>(STORAGE_KEY)?.values.title).toBe(
                'Changed title'
            )
        })

        const values = readStoredForm<SettingsFormValues>(STORAGE_KEY)?.values
        expect(values?.enabled).toBe(true)
        expect(values?.tags).toEqual(['a', 'b'])
    })

    it('resets controlled values and saves the reset state', async () => {
        const { container, getByText } = render(<ControlledDemo />)

        fireEvent.change(getInput(container, 'title'), { target: { value: 'Changed title' } })
        fireEvent.click(getByText('reset'))

        await waitFor(() => {
            expect(getInput(container, 'title').value).toBe('Default title')
        })
        await waitFor(() => {
            expect(readStoredForm<SettingsFormValues>(STORAGE_KEY)?.values.title).toBe(
                'Default title'
            )
        })
    })

    it('clears storage without changing controlled values', async () => {
        const { container, getByText } = render(<ControlledDemo />)

        fireEvent.change(getInput(container, 'title'), { target: { value: 'Saved title' } })

        await waitFor(() => {
            expect(readStoredForm<SettingsFormValues>(STORAGE_KEY)).not.toBeNull()
        })

        fireEvent.click(getByText('clear'))

        expect(readStoredForm<SettingsFormValues>(STORAGE_KEY)).toBeNull()
        expect(getInput(container, 'title').value).toBe('Saved title')
    })
})
