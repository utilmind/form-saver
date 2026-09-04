/**
 * Hook-level tests for the DOM auto-binding API.
 *
 * These tests render small uncontrolled forms in jsdom to verify the behavior
 * that cannot be covered by pure domControls unit tests: mount restore,
 * event-driven saving, reset/clear helpers, and beforeunload flushing.
 */

// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { readStoredForm, writeStoredForm } from '../src/storage'
import type { FormSaverUrlHashOptions } from '../src/types'
import { useFormSaverDom } from '../src/useFormSaverDom'
import { installTestBrowserStorage } from './testStorage'

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
    urlHash = false,
    onSave,
    autosaveIntervalSeconds,
    defaultEnabled = false
}: {
    storageKey?: string
    saveEvent?: 'change' | 'input'
    debounceMs?: number
    urlHash?: boolean | FormSaverUrlHashOptions
    onSave?: () => void
    autosaveIntervalSeconds?: number
    defaultEnabled?: boolean
}) => {
    const formSaver = useFormSaverDom<HTMLFormElement>({
        storageKey,
        saveEvent,
        debounceMs,
        urlHash,
        onSave,
        autosaveIntervalSeconds
    })

    return (
        <div>
            <form ref={formSaver.ref}>
                <input name="title" defaultValue="Default title" />
                <textarea name="notes" defaultValue="Default notes" />
                <input name="enabled" type="checkbox" defaultChecked={defaultEnabled} />
                <select name="tags" multiple defaultValue={[]}>
                    <option value="a">A</option>
                    <option value="b">B</option>
                </select>
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
            <button type="button" onClick={() => formSaver.clearUrlHashValues()}>
                clear hash
            </button>
            <button type="button" onClick={() => formSaver.restoreUrlHashFromStorage()}>
                restore hash
            </button>
            <output data-testid="restored">{formSaver.hasRestored ? 'yes' : 'no'}</output>
        </div>
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

    it('automatically restores storage into the hash when URL synchronization is enabled', async () => {
        writeStoredForm(STORAGE_KEY, {
            title: 'Stored DOM title',
            notes: 'Stored DOM notes',
            enabled: true
        })

        const { container } = render(<DomDemo urlHash />)

        await waitFor(() => {
            expect(new URLSearchParams(window.location.hash.slice(1)).get('title')).toBe(
                'Stored DOM title'
            )
        })

        expect(getInput(container, 'title').value).toBe('Stored DOM title')
        expect(getInput(container, 'enabled').checked).toBe(true)
    })

    it('uses native defaultChecked to omit default checkbox state and encode deviations', async () => {
        writeStoredForm(STORAGE_KEY, {
            title: '',
            notes: '',
            enabled: true
        })

        const { container } = render(<DomDemo defaultEnabled urlHash />)
        const enabled = getInput(container, 'enabled')

        await waitFor(() => {
            expect(enabled.checked).toBe(true)
            expect(new URLSearchParams(window.location.hash.slice(1)).has('enabled')).toBe(false)
        })

        fireEvent.click(enabled)
        await waitFor(() => {
            expect(new URLSearchParams(window.location.hash.slice(1)).get('enabled')).toBe('0')
        })

        fireEvent.click(enabled)
        await waitFor(() => {
            expect(new URLSearchParams(window.location.hash.slice(1)).has('enabled')).toBe(false)
        })
    })

    it('restores DOM values from the hash before browser storage', async () => {
        writeStoredForm(STORAGE_KEY, {
            title: 'Storage title',
            notes: 'Storage notes',
            enabled: false
        })
        window.history.replaceState(null, '', '/#title=Hash+title&notes=Hash+notes&enabled=1')

        const { container } = render(<DomDemo urlHash />)

        await waitFor(() => {
            expect(getInput(container, 'title').value).toBe('Hash title')
        })

        expect(getTextarea(container, 'notes').value).toBe('Hash notes')
        expect(getInput(container, 'enabled').checked).toBe(true)
        expect(readStoredForm(STORAGE_KEY)?.values.title).toBe('Hash title')
    })

    it('can disable the default array separator for DOM multi-select values', async () => {
        const { container } = render(<DomDemo urlHash={{ arraySeparator: false }} />)
        const tags = container.querySelector<HTMLSelectElement>('select[name="tags"]')

        if (!tags) {
            throw new Error('Missing tags select')
        }

        tags.options[0].selected = true
        tags.options[1].selected = true
        fireEvent.change(tags)

        await waitFor(() => {
            expect(new URLSearchParams(window.location.hash.slice(1)).getAll('tags')).toEqual([
                'a',
                'b'
            ])
        })
    })

    it('keeps an external first hash part while DOM values restore and change', async () => {
        window.history.replaceState(
            null,
            '',
            '/#39.41,-84.20x39.32,-84.40&title=Hash+DOM+title&enabled=1'
        )

        const { container } = render(<DomDemo urlHash={{ keepFirstHashPart: true }} />)

        await waitFor(() => {
            expect(getInput(container, 'title').value).toBe('Hash DOM title')
        })
        expect(window.location.hash.startsWith('#39.41,-84.20x39.32,-84.40&')).toBe(true)

        fireEvent.change(getInput(container, 'title'), { target: { value: 'Changed DOM title' } })

        await waitFor(() => {
            expect(
                new URLSearchParams(window.location.hash.split('&').slice(1).join('&')).get('title')
            ).toBe('Changed DOM title')
        })
        expect(window.location.hash.startsWith('#39.41,-84.20x39.32,-84.40&')).toBe(true)
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

    it('autosaves a dirty focused DOM text control once per configured interval', () => {
        vi.useFakeTimers()
        const onSave = vi.fn()
        const { container } = render(<DomDemo autosaveIntervalSeconds={30} onSave={onSave} />)
        const title = getInput(container, 'title')

        title.focus()
        fireEvent.input(title, { target: { value: 'Long DOM edit' } })

        act(() => {
            vi.advanceTimersByTime(29_999)
        })
        expect(readStoredForm(STORAGE_KEY)).toBeNull()

        act(() => {
            vi.advanceTimersByTime(1)
        })
        expect(readStoredForm(STORAGE_KEY)?.values.title).toBe('Long DOM edit')
        expect(onSave).toHaveBeenCalledTimes(1)

        act(() => {
            vi.advanceTimersByTime(30_000)
        })
        expect(onSave).toHaveBeenCalledTimes(1)
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

    it('restores the focused DOM value from storage when reload keeps a stale hash', async () => {
        writeStoredForm(STORAGE_KEY, {
            title: 'Old DOM title',
            notes: 'Old DOM notes',
            enabled: false
        })
        const oldHash = '#title=Old+DOM+title&notes=Old+DOM+notes'
        window.history.replaceState(null, '', `/${oldHash}`)

        const firstRender = render(<DomDemo debounceMs={5000} urlHash />)
        const title = getInput(firstRender.container, 'title')

        await waitFor(() => {
            expect(title.value).toBe('Old DOM title')
        })

        title.focus()
        fireEvent.input(title, { target: { value: 'Typed DOM value before F5' } })
        expect(readStoredForm(STORAGE_KEY)?.values.title).toBe('Old DOM title')

        window.dispatchEvent(new Event('beforeunload'))
        expect(readStoredForm(STORAGE_KEY)?.values.title).toBe('Typed DOM value before F5')
        expect(window.location.hash).toBe(oldHash)

        firstRender.unmount()
        window.history.replaceState(null, '', `/${oldHash}`)

        const secondRender = render(<DomDemo debounceMs={5000} urlHash />)

        await waitFor(() => {
            expect(getInput(secondRender.container, 'title').value).toBe(
                'Typed DOM value before F5'
            )
        })
        await waitFor(() => {
            expect(new URLSearchParams(window.location.hash.slice(1)).get('title')).toBe(
                'Typed DOM value before F5'
            )
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
