/**
 * Pure tests for readable URL hash serialization and runtime type restoration.
 */

// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'

import { writeStoredForm } from '../src/storage'
import {
    clearFormValuesFromUrlHash,
    readFormValuesFromUrlHash,
    restoreUrlHashFromStorage,
    serializeFormValuesToUrlHash,
    writeFormValuesToUrlHash
} from '../src/urlHash'
import { installTestBrowserStorage } from './testStorage'

interface HashSettings {
    searchQuery: string
    enabled: boolean
    resultsPerPage: number
    tags: string[]
    notes: string
}

const TEMPLATE: HashSettings = {
    searchQuery: '',
    enabled: false,
    resultsPerPage: 20,
    tags: [],
    notes: ''
}

beforeEach(() => {
    installTestBrowserStorage()
    window.history.replaceState(null, '', '/')
})

describe('URL hash form values', () => {
    it('serializes non-empty values, compact booleans, and repeated array parameters', () => {
        expect(
            serializeFormValuesToUrlHash<HashSettings>(
                {
                    searchQuery: 'lathe shop',
                    enabled: true,
                    resultsPerPage: 50,
                    tags: ['alpha', 'beta'],
                    notes: ''
                },
                TEMPLATE
            )
        ).toBe('#searchQuery=lathe+shop&enabled=1&resultsPerPage=50&tags=alpha&tags=beta')
    })

    it('omits empty values and checkbox states that match their defaults', () => {
        expect(
            serializeFormValuesToUrlHash<HashSettings>(
                {
                    searchQuery: '',
                    enabled: false,
                    tags: [],
                    notes: ''
                },
                TEMPLATE
            )
        ).toBe('')

        const checkedByDefault = {
            ...TEMPLATE,
            enabled: true
        }

        expect(
            serializeFormValuesToUrlHash<HashSettings>({ enabled: true }, checkedByDefault)
        ).toBe('')
        expect(
            serializeFormValuesToUrlHash<HashSettings>({ enabled: false }, checkedByDefault)
        ).toBe('#enabled=0')
    })

    it('restores runtime types from compact hash values', () => {
        const values = readFormValuesFromUrlHash<HashSettings>(
            '#searchQuery=precision&enabled=1&resultsPerPage=75&tags=alpha&tags=beta',
            TEMPLATE
        )

        expect(values).toEqual({
            searchQuery: 'precision',
            enabled: true,
            resultsPerPage: 75,
            tags: ['alpha', 'beta'],
            notes: ''
        })
        expect(readFormValuesFromUrlHash<HashSettings>('#enabled=0', TEMPLATE)).toEqual({
            searchQuery: '',
            enabled: false,
            resultsPerPage: 20,
            tags: [],
            notes: ''
        })
    })

    it('omits an empty array because absence represents no selection', () => {
        const hash = serializeFormValuesToUrlHash<HashSettings>({ tags: [] }, TEMPLATE)

        expect(hash).toBe('')
        expect(readFormValuesFromUrlHash<HashSettings>(hash, TEMPLATE)).toBeNull()
    })

    it('restores a compact hash directly from browser storage', () => {
        writeStoredForm<HashSettings>('hash-settings', {
            searchQuery: 'stored query',
            enabled: true,
            resultsPerPage: 40,
            tags: ['alpha', 'beta'],
            notes: ''
        })

        const restored = restoreUrlHashFromStorage<HashSettings>('hash-settings', {
            defaultValues: TEMPLATE
        })
        const params = new URLSearchParams(window.location.hash.slice(1))

        expect(restored?.values.searchQuery).toBe('stored query')
        expect(params.get('searchQuery')).toBe('stored query')
        expect(params.get('enabled')).toBe('1')
        expect(params.getAll('tags')).toEqual(['alpha', 'beta'])
        expect(params.has('notes')).toBe(false)
    })

    it('updates and clears the browser hash without reloading the page', () => {
        expect(writeFormValuesToUrlHash<HashSettings>({ searchQuery: 'shared link' })).toBe(true)
        expect(window.location.hash).toBe('#searchQuery=shared+link')

        expect(clearFormValuesFromUrlHash()).toBe(true)
        expect(window.location.hash).toBe('')
    })
})
