/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { App } from '../demo/src/App'
import { STORAGE_KEYS } from '../demo/src/demo-shared'
import { writeStoredForm } from '../src/storage'

const getHashParams = (): URLSearchParams => new URLSearchParams(window.location.hash.slice(1))

describe('demo tab URL synchronization', () => {
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
})
