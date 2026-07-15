/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { App } from '../demo/src/App'
import { STORAGE_KEYS } from '../demo/src/demo-shared'
import { writeStoredForm } from '../src/storage'

const getHashParams = (): URLSearchParams => new URLSearchParams(window.location.hash.slice(1))

describe('demo URL synchronization', () => {
    afterEach(() => {
        cleanup()
    })

    beforeEach(() => {
        window.localStorage.clear()
        window.history.replaceState(null, '', '/?demo=controlled-bind')
    })

    it('switches the hash to the target tab saved values', () => {
        writeStoredForm(STORAGE_KEYS['dom-hook'], {
            projectName: 'DOM project',
            emailNotifications: true,
            mode: 'expert',
            density: 'dense',
            features: ['ocr', 'geo'],
            tags: ['beta'],
            notes: 'Stored DOM values',
            customReviewed: true,
            customReviewLevel: 'full'
        })

        render(<App />)
        fireEvent.click(screen.getByRole('button', { name: /2\. DOM hook/i }))

        const params = getHashParams()

        expect(window.location.pathname).toBe('/')
        expect(window.location.search).toBe('?demo=dom-hook')
        expect(params.get('projectName')).toBe('DOM project')
        expect(params.get('emailNotifications')).toBe('true')
        expect(params.getAll('features')).toEqual(['ocr', 'geo'])
        expect(params.get('customReviewLevel')).toBe('full')
    })

    it('flushes pending DOM changes before leaving a tab', () => {
        window.history.replaceState(null, '', '/?demo=dom-hook')

        render(<App />)
        fireEvent.input(screen.getByLabelText('Project name'), {
            target: { value: 'Unsaved project' }
        })

        fireEvent.click(screen.getByRole('button', { name: /3\. Scope component/i }))
        fireEvent.click(screen.getByRole('button', { name: /2\. DOM hook/i }))

        expect(getHashParams().get('projectName')).toBe('Unsaved project')
        expect(screen.getByLabelText('Project name').value).toBe('Unsaved project')
    })

    it('restores a DOM tab hash through FormSaver after returning from About', async () => {
        writeStoredForm(STORAGE_KEYS['dom-hook'], {
            projectName: 'Restored DOM route',
            emailNotifications: true,
            mode: 'advanced',
            density: 'compact',
            features: ['ocr'],
            tags: ['gamma'],
            notes: 'DOM route notes',
            customReviewed: false,
            customReviewLevel: 'quick'
        })
        window.history.replaceState(null, '', '/?demo=dom-hook')

        render(<App />)

        await waitFor(() => {
            expect(getHashParams().get('projectName')).toBe('Restored DOM route')
        })

        fireEvent.click(screen.getByRole('link', { name: 'About' }))

        expect(window.location.pathname).toBe('/about/')
        expect(window.location.search).toBe('')
        expect(window.location.hash).toBe('')

        fireEvent.click(screen.getByRole('link', { name: 'View demo' }))

        expect(window.location.pathname).toBe('/')
        expect(window.location.search).toBe('?demo=dom-hook')

        await waitFor(() => {
            expect(getHashParams().get('projectName')).toBe('Restored DOM route')
        })
        expect(screen.getByLabelText('Project name').value).toBe('Restored DOM route')
    })

    it('hides the demo hash on About and restores it when returning to Demo', async () => {
        render(<App />)
        fireEvent.change(screen.getByLabelText('Search query'), {
            target: { value: 'Restored from storage' }
        })

        fireEvent.click(screen.getByRole('link', { name: 'About' }))

        expect(window.location.pathname).toBe('/about/')
        expect(window.location.search).toBe('')
        expect(window.location.hash).toBe('')
        expect(screen.getByText(/React hook package/)).toBeTruthy()

        fireEvent.click(screen.getByRole('link', { name: 'View demo' }))

        expect(window.location.pathname).toBe('/')
        expect(window.location.search).toBe('?demo=controlled-bind')

        await waitFor(() => {
            expect(getHashParams().get('searchQuery')).toBe('Restored from storage')
        })
        expect(screen.getByLabelText('Search query').value).toBe('Restored from storage')
    })
})
