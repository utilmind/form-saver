/**
 * Hook-level tests for the controlled React state API.
 *
 * The pure storage tests cover persistence details. These tests verify that the
 * public hook restores after mount, binds native controls, saves after changes,
 * and exposes reset/clear helpers as expected by React consumers.
 */

// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { readStoredForm, writeStoredForm } from '../src/storage'
import type { FormSaverSaveEvent, FormSaverUrlHashOptions } from '../src/types'
import { useFormSaver } from '../src/useFormSaver'
import { installTestBrowserStorage } from './testStorage'

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

const ControlledDemoWithoutInitialValues = () => {
    const formSaver = useFormSaver<SettingsFormValues>({
        storageKey: STORAGE_KEY,
        debounceMs: 0
    })

    return (
        <form>
            <input {...formSaver.bind.text('title')} />
            <textarea {...formSaver.bind.textarea('notes')} />
            <input type="checkbox" {...formSaver.bind.checkbox('enabled')} />
            <select {...formSaver.bind.multiSelect('tags')}>
                <option value="a">A</option>
                <option value="b">B</option>
            </select>
            <output data-testid="title-value">{formSaver.getString('title')}</output>
            <output data-testid="enabled-value">
                {formSaver.getBoolean('enabled') ? 'yes' : 'no'}
            </output>
            <output data-testid="tags-count">{formSaver.getArray('tags').length}</output>
            <button type="button" onClick={() => formSaver.resetValues()}>
                reset
            </button>
        </form>
    )
}

interface ControlledDemoProps {
    initialValues?: SettingsFormValues
    debounceMs?: number
    urlHash?: boolean | FormSaverUrlHashOptions
    saveEvent?: FormSaverSaveEvent
    autosaveIntervalSeconds?: number
    onSave?: () => void
}

const ControlledDemo = ({
    initialValues = INITIAL_VALUES,
    debounceMs = 0,
    urlHash = false,
    saveEvent,
    autosaveIntervalSeconds,
    onSave
}: ControlledDemoProps) => {
    const formSaver = useFormSaver<SettingsFormValues>({
        storageKey: STORAGE_KEY,
        initialValues,
        debounceMs,
        saveEvent,
        autosaveIntervalSeconds,
        urlHash,
        onSave
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
            <button type="button" onClick={() => formSaver.clearUrlHashValues()}>
                clear hash
            </button>
            <button type="button" onClick={() => formSaver.restoreUrlHashFromStorage()}>
                restore hash
            </button>
            <output data-testid="restored">{formSaver.hasRestored ? 'yes' : 'no'}</output>
        </form>
    )
}

beforeEach(() => {
    installTestBrowserStorage()
    window.history.replaceState(null, '', '/')
})

afterEach(() => {
    cleanup()
    vi.useRealTimers()
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

    it('can read safe helper values without explicit initialValues', async () => {
        writeStoredForm<SettingsFormValues>(STORAGE_KEY, {
            title: 'Restored without defaults',
            enabled: true,
            tags: ['b'],
            notes: 'Restored notes'
        })

        const { container, getByTestId, getByText } = render(<ControlledDemoWithoutInitialValues />)

        await waitFor(() => {
            expect(getInput(container, 'title').value).toBe('Restored without defaults')
        })

        expect(getByTestId('title-value').textContent).toBe('Restored without defaults')
        expect(getByTestId('enabled-value').textContent).toBe('yes')
        expect(getByTestId('tags-count').textContent).toBe('1')
        expect(getSelect(container, 'tags').selectedOptions[0].value).toBe('b')
        expect(getTextarea(container, 'notes').value).toBe('Restored notes')

        fireEvent.click(getByText('reset'))

        expect(getInput(container, 'title').value).toBe('')
        expect(getInput(container, 'enabled').checked).toBe(false)
        expect(getByTestId('title-value').textContent).toBe('')
        expect(getByTestId('enabled-value').textContent).toBe('no')
        expect(getByTestId('tags-count').textContent).toBe('0')
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

    it('does not save controlled text or update its hash on each input by default', async () => {
        const { container } = render(<ControlledDemo urlHash />)
        const title = getInput(container, 'title')

        await waitFor(() => {
            expect(new URLSearchParams(window.location.hash.slice(1)).get('title')).toBe(
                'Default title'
            )
        })

        title.focus()
        fireEvent.change(title, { target: { value: 'Typing without blur' } })

        expect(readStoredForm<SettingsFormValues>(STORAGE_KEY)).toBeNull()
        expect(new URLSearchParams(window.location.hash.slice(1)).get('title')).toBe(
            'Default title'
        )

        fireEvent.blur(title)

        await waitFor(() => {
            expect(readStoredForm<SettingsFormValues>(STORAGE_KEY)?.values.title).toBe(
                'Typing without blur'
            )
            expect(new URLSearchParams(window.location.hash.slice(1)).get('title')).toBe(
                'Typing without blur'
            )
        })
    })

    it('supports explicit save-while-typing for controlled binders', async () => {
        const { container } = render(<ControlledDemo saveEvent="input" />)

        fireEvent.change(getInput(container, 'title'), {
            target: { value: 'Saved during input' }
        })

        await waitFor(() => {
            expect(readStoredForm<SettingsFormValues>(STORAGE_KEY)?.values.title).toBe(
                'Saved during input'
            )
        })
    })

    it('autosaves a dirty focused controlled text control once per configured interval', () => {
        vi.useFakeTimers()
        const onSave = vi.fn()
        const { container } = render(
            <ControlledDemo autosaveIntervalSeconds={30} onSave={onSave} urlHash />
        )
        const title = getInput(container, 'title')

        title.focus()
        fireEvent.change(title, { target: { value: 'Long running edit' } })
        expect(document.activeElement).toBe(title)

        act(() => {
            vi.advanceTimersByTime(20_000)
        })
        fireEvent.change(title, { target: { value: 'Latest long running edit' } })

        act(() => {
            vi.advanceTimersByTime(9_999)
        })
        expect(readStoredForm<SettingsFormValues>(STORAGE_KEY)).toBeNull()

        act(() => {
            vi.advanceTimersByTime(1)
        })
        expect(readStoredForm<SettingsFormValues>(STORAGE_KEY)?.values.title).toBe(
            'Latest long running edit'
        )
        expect(onSave).toHaveBeenCalledTimes(1)
        expect(new URLSearchParams(window.location.hash.slice(1)).get('title')).toBe(
            'Latest long running edit'
        )

        act(() => {
            vi.advanceTimersByTime(30_000)
        })
        expect(onSave).toHaveBeenCalledTimes(1)
    })

    it('can disable focused-control autosave with a zero interval', () => {
        vi.useFakeTimers()
        const { container } = render(<ControlledDemo autosaveIntervalSeconds={0} />)
        const title = getInput(container, 'title')

        title.focus()
        fireEvent.change(title, { target: { value: 'Still unsaved' } })

        act(() => {
            vi.advanceTimersByTime(60_000)
        })

        expect(readStoredForm<SettingsFormValues>(STORAGE_KEY)).toBeNull()
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

    it('stores checkbox deviations as 1/0 and omits the default state', async () => {
        const { container } = render(<ControlledDemo urlHash />)
        const enabled = getInput(container, 'enabled')

        await waitFor(() => {
            expect(new URLSearchParams(window.location.hash.slice(1)).has('enabled')).toBe(false)
        })

        fireEvent.click(enabled)
        await waitFor(() => {
            expect(new URLSearchParams(window.location.hash.slice(1)).get('enabled')).toBe('1')
        })

        fireEvent.click(enabled)
        await waitFor(() => {
            expect(new URLSearchParams(window.location.hash.slice(1)).has('enabled')).toBe(false)
        })

        const checkedByDefaultValues: SettingsFormValues = {
            ...INITIAL_VALUES,
            enabled: true
        }
        cleanup()
        window.localStorage.clear()
        window.history.replaceState(null, '', '/')

        const checkedByDefaultRender = render(
            <ControlledDemo initialValues={checkedByDefaultValues} urlHash />
        )
        const checkedByDefault = getInput(checkedByDefaultRender.container, 'enabled')

        await waitFor(() => {
            expect(new URLSearchParams(window.location.hash.slice(1)).has('enabled')).toBe(false)
        })

        fireEvent.click(checkedByDefault)
        await waitFor(() => {
            expect(new URLSearchParams(window.location.hash.slice(1)).get('enabled')).toBe('0')
        })
    })

    it('restores URL hash values before localStorage and persists the selected source', async () => {
        writeStoredForm<SettingsFormValues>(STORAGE_KEY, {
            title: 'Storage title',
            enabled: false,
            mode: 'fast',
            tags: [],
            notes: 'Storage notes'
        })
        window.history.replaceState(
            null,
            '',
            '/#title=Hash+title&enabled=1&mode=accurate&tags=a&tags=b&notes=Hash+notes'
        )

        const { container } = render(<ControlledDemo urlHash />)

        await waitFor(() => {
            expect(getInput(container, 'title').value).toBe('Hash title')
        })

        expect(getInput(container, 'enabled').checked).toBe(true)
        expect(getSelect(container, 'tags').selectedOptions).toHaveLength(2)
        expect(getTextarea(container, 'notes').value).toBe('Hash notes')

        await waitFor(() => {
            expect(readStoredForm<SettingsFormValues>(STORAGE_KEY)?.values.title).toBe('Hash title')
        })
    })

    it('mirrors restored and changed controlled values into the URL hash', async () => {
        writeStoredForm<SettingsFormValues>(STORAGE_KEY, {
            title: 'Restored title',
            enabled: true,
            mode: 'accurate',
            tags: ['a'],
            notes: 'Restored notes'
        })

        const { container } = render(<ControlledDemo urlHash />)

        await waitFor(() => {
            expect(new URLSearchParams(window.location.hash.slice(1)).get('title')).toBe(
                'Restored title'
            )
        })

        fireEvent.change(getInput(container, 'title'), { target: { value: 'Changed for link' } })
        const tags = getSelect(container, 'tags')
        tags.options[0].selected = true
        tags.options[1].selected = true
        fireEvent.change(tags)

        await waitFor(() => {
            const params = new URLSearchParams(window.location.hash.slice(1))

            expect(params.get('title')).toBe('Changed for link')
            expect(params.getAll('tags')).toEqual(['a', 'b'])
        })
    })

    it('uses the configured array separator for controlled array values', async () => {
        const { container } = render(<ControlledDemo urlHash={{ arraySeparator: ',' }} />)
        const tags = getSelect(container, 'tags')
        tags.options[0].selected = true
        tags.options[1].selected = true
        fireEvent.change(tags)

        await waitFor(() => {
            expect(window.location.hash).toContain('tags=a,b')
        })
    })

    it('keeps an external first hash part while controlled values restore and change', async () => {
        window.history.replaceState(
            null,
            '',
            '/#39.41,-84.20x39.32,-84.40&title=Hash+title&enabled=1'
        )

        const { container } = render(<ControlledDemo urlHash={{ keepFirstHashPart: true }} />)

        await waitFor(() => {
            expect(getInput(container, 'title').value).toBe('Hash title')
        })
        expect(window.location.hash.startsWith('#39.41,-84.20x39.32,-84.40&')).toBe(true)

        const title = getInput(container, 'title')
        fireEvent.change(title, { target: { value: 'Changed title' } })
        fireEvent.blur(title)

        await waitFor(() => {
            expect(
                new URLSearchParams(window.location.hash.split('&').slice(1).join('&')).get('title')
            ).toBe('Changed title')
        })
        expect(window.location.hash.startsWith('#39.41,-84.20x39.32,-84.40&')).toBe(true)
    })

    it('flushes focused controlled input and prefers storage over a stale hash after reload', async () => {
        writeStoredForm<SettingsFormValues>(STORAGE_KEY, {
            title: 'Old title',
            enabled: false,
            mode: 'fast',
            tags: ['a'],
            notes: 'Old notes'
        })
        const oldHash = '#title=Old+title&mode=fast&tags=a&notes=Old+notes'
        window.history.replaceState(null, '', `/${oldHash}`)

        const firstRender = render(<ControlledDemo debounceMs={5000} urlHash />)
        const title = getInput(firstRender.container, 'title')

        await waitFor(() => {
            expect(title.value).toBe('Old title')
        })

        title.focus()
        fireEvent.change(title, { target: { value: 'Typed before F5' } })
        expect(readStoredForm<SettingsFormValues>(STORAGE_KEY)?.values.title).toBe('Old title')

        window.dispatchEvent(new Event('beforeunload'))
        expect(readStoredForm<SettingsFormValues>(STORAGE_KEY)?.values.title).toBe(
            'Typed before F5'
        )
        expect(window.location.hash).toBe(oldHash)

        firstRender.unmount()
        window.history.replaceState(null, '', `/${oldHash}`)

        const secondRender = render(<ControlledDemo debounceMs={5000} urlHash />)

        await waitFor(() => {
            expect(getInput(secondRender.container, 'title').value).toBe('Typed before F5')
        })
        await waitFor(() => {
            expect(new URLSearchParams(window.location.hash.slice(1)).get('title')).toBe(
                'Typed before F5'
            )
        })
    })

    it('keeps a genuinely different shared hash authoritative after page unload', async () => {
        writeStoredForm<SettingsFormValues>(STORAGE_KEY, {
            title: 'Old title',
            enabled: false,
            mode: 'fast',
            tags: ['a'],
            notes: 'Old notes'
        })
        const oldHash = '#title=Old+title&mode=fast&tags=a&notes=Old+notes'
        window.history.replaceState(null, '', `/${oldHash}`)

        const firstRender = render(<ControlledDemo debounceMs={5000} urlHash />)
        const title = getInput(firstRender.container, 'title')

        await waitFor(() => {
            expect(title.value).toBe('Old title')
        })

        title.focus()
        fireEvent.change(title, { target: { value: 'Typed before navigation' } })
        window.dispatchEvent(new Event('beforeunload'))
        firstRender.unmount()

        window.history.replaceState(
            null,
            '',
            '/#title=Shared+title&enabled=1&mode=accurate&tags=b&notes=Shared+notes'
        )

        const secondRender = render(<ControlledDemo debounceMs={5000} urlHash />)

        await waitFor(() => {
            expect(getInput(secondRender.container, 'title').value).toBe('Shared title')
        })
        expect(getInput(secondRender.container, 'enabled').checked).toBe(true)
        expect(getTextarea(secondRender.container, 'notes').value).toBe('Shared notes')
    })

    it('can explicitly restore the URL hash from storage', () => {
        writeStoredForm<SettingsFormValues>(STORAGE_KEY, {
            title: 'Stored for hash',
            enabled: true,
            mode: 'accurate',
            tags: ['b'],
            notes: 'Stored notes'
        })

        const { getByText } = render(<ControlledDemo />)

        fireEvent.click(getByText('restore hash'))

        const params = new URLSearchParams(window.location.hash.slice(1))
        expect(params.get('title')).toBe('Stored for hash')
        expect(params.get('enabled')).toBe('1')
        expect(params.getAll('tags')).toEqual(['b'])
    })

    it('clears storage without changing controlled values', async () => {
        const { container, getByText } = render(<ControlledDemo />)

        const title = getInput(container, 'title')
        fireEvent.change(title, { target: { value: 'Saved title' } })
        fireEvent.blur(title)

        await waitFor(() => {
            expect(readStoredForm<SettingsFormValues>(STORAGE_KEY)).not.toBeNull()
        })

        fireEvent.click(getByText('clear'))

        expect(readStoredForm<SettingsFormValues>(STORAGE_KEY)).toBeNull()
        expect(getInput(container, 'title').value).toBe('Saved title')
    })
})
