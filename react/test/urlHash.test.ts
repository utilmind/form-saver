/**
 * Pure tests for readable URL hash serialization and runtime type restoration.
 */

// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'

import {
    clearFormValuesFromUrlHash,
    readFormValuesFromUrlHash,
    serializeFormValuesToUrlHash,
    writeFormValuesToUrlHash
} from '../src/urlHash'

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
    window.history.replaceState(null, '', '/')
})

describe('URL hash form values', () => {
    it('serializes readable primitive and repeated array parameters', () => {
        expect(
            serializeFormValuesToUrlHash<HashSettings>({
                searchQuery: 'lathe shop',
                enabled: true,
                resultsPerPage: 50,
                tags: ['alpha', 'beta'],
                notes: ''
            })
        ).toBe('#searchQuery=lathe+shop&enabled=true&resultsPerPage=50&tags=alpha&tags=beta&notes=')
    })

    it('restores runtime types from the initial-values template', () => {
        const values = readFormValuesFromUrlHash<HashSettings>(
            '#searchQuery=precision&enabled=true&resultsPerPage=75&tags=alpha&tags=beta&notes=',
            TEMPLATE
        )

        expect(values).toEqual({
            searchQuery: 'precision',
            enabled: true,
            resultsPerPage: 75,
            tags: ['alpha', 'beta'],
            notes: ''
        })
    })

    it('keeps an empty array visible and restores it as an array', () => {
        const hash = serializeFormValuesToUrlHash<HashSettings>({ tags: [] })

        expect(hash).toBe('#tags=')
        expect(readFormValuesFromUrlHash<HashSettings>(hash, TEMPLATE)).toEqual({ tags: [] })
    })

    it('updates and clears the browser hash without reloading the page', () => {
        expect(writeFormValuesToUrlHash<HashSettings>({ searchQuery: 'shared link' })).toBe(true)
        expect(window.location.hash).toBe('#searchQuery=shared+link')

        expect(clearFormValuesFromUrlHash()).toBe(true)
        expect(window.location.hash).toBe('')
    })
})
