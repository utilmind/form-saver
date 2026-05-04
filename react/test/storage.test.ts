import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
    clearStorageKeys,
    getStorage,
    isStorageAvailable,
    readStoredForm,
    removeStoredForm,
    removeStoredValueKeys,
    writeStoredForm
} from '../src/storage'

interface TestValues {
    query: string
    enabled: boolean
    count: number
    tags: string[]
    notes?: string
}

class MemoryStorage implements Storage {
    private items: Record<string, string> = {}

    get length(): number {
        return Object.keys(this.items).length
    }

    clear(): void {
        this.items = {}
    }

    getItem(key: string): string | null {
        return Object.prototype.hasOwnProperty.call(this.items, key) ? this.items[key] : null
    }

    key(index: number): string | null {
        return Object.keys(this.items)[index] || null
    }

    removeItem(key: string): void {
        delete this.items[key]
    }

    setItem(key: string, value: string): void {
        this.items[key] = String(value)
    }
}

function installBrowserStorage(): { localStorage: Storage; sessionStorage: Storage } {
    const localStorage = new MemoryStorage()
    const sessionStorage = new MemoryStorage()

    vi.stubGlobal('window', {
        localStorage: localStorage,
        sessionStorage: sessionStorage
    })

    return { localStorage: localStorage, sessionStorage: sessionStorage }
}

function readRawStorageJson(storageKey: string, storage: Storage): unknown {
    const raw = storage.getItem(storageKey)

    return raw ? JSON.parse(raw) : null
}

describe('storage helper', function () {
    let localStorage: Storage
    let sessionStorage: Storage

    beforeEach(function () {
        const storages = installBrowserStorage()

        localStorage = storages.localStorage
        sessionStorage = storages.sessionStorage
    })

    it('reports available browser storage in the test browser environment', function () {
        expect(isStorageAvailable('localStorage')).toBe(true)
        expect(isStorageAvailable('sessionStorage')).toBe(true)
    })

    it('returns null or false when browser storage is unavailable', function () {
        vi.unstubAllGlobals()

        expect(getStorage()).toBeNull()
        expect(isStorageAvailable()).toBe(false)
        expect(readStoredForm<TestValues>('settings')).toBeNull()
        expect(writeStoredForm<TestValues>('settings', { query: 'ignored' })).toBeNull()

        expect(function () {
            removeStoredForm('settings')
            clearStorageKeys('settings:')
        }).not.toThrow()
    })

    it('writes and reads one JSON envelope with values and metadata', function () {
        const saved = writeStoredForm<TestValues>(
            'settings',
            {
                query: 'coffee',
                enabled: true,
                count: 20,
                tags: ['fast', 'fresh']
            },
            {
                version: 'react-v1',
                now: function () {
                    return 123456
                }
            }
        )

        expect(saved).toEqual({
            values: {
                query: 'coffee',
                enabled: true,
                count: 20,
                tags: ['fast', 'fresh']
            },
            meta: {
                savedAt: 123456,
                version: 'react-v1'
            }
        })

        expect(readStoredForm<TestValues>('settings')).toEqual(saved)
        expect(readRawStorageJson('settings', localStorage)).toEqual(saved)
    })

    it('returns null for missing, invalid, or unsupported stored data', function () {
        expect(readStoredForm<TestValues>('missing')).toBeNull()

        localStorage.setItem('invalid-json', '{')
        expect(readStoredForm<TestValues>('invalid-json')).toBeNull()

        localStorage.setItem('legacy-object', JSON.stringify({ query: 'legacy' }))
        expect(readStoredForm<TestValues>('legacy-object')).toBeNull()

        localStorage.setItem(
            'invalid-envelope',
            JSON.stringify({ values: { query: 'x' }, meta: { savedAt: 'wrong-type' } })
        )
        expect(readStoredForm<TestValues>('invalid-envelope')).toBeNull()
    })

    it('preserves unknown keys by default when saving partial values', function () {
        writeStoredForm<TestValues>(
            'shared-form',
            {
                query: 'first page',
                enabled: true,
                count: 10,
                tags: ['a']
            },
            {
                now: function () {
                    return 100
                }
            }
        )

        const saved = writeStoredForm<TestValues>(
            'shared-form',
            {
                query: 'second page'
            },
            {
                now: function () {
                    return 200
                }
            }
        )

        expect(saved).toEqual({
            values: {
                query: 'second page',
                enabled: true,
                count: 10,
                tags: ['a']
            },
            meta: {
                savedAt: 200
            }
        })
    })

    it('can replace stored values instead of preserving unknown keys', function () {
        writeStoredForm<TestValues>('shared-form', {
            query: 'first page',
            enabled: true,
            count: 10,
            tags: ['a']
        })

        const saved = writeStoredForm<TestValues>(
            'shared-form',
            {
                query: 'second page'
            },
            {
                mergeUnknownKeys: false,
                now: function () {
                    return 300
                }
            }
        )

        expect(saved).toEqual({
            values: {
                query: 'second page'
            },
            meta: {
                savedAt: 300
            }
        })
    })

    it('deletes a value when the next partial value is undefined', function () {
        writeStoredForm<TestValues>('settings', {
            query: 'search',
            enabled: true,
            count: 5,
            tags: ['saved']
        })

        const saved = writeStoredForm<TestValues>(
            'settings',
            {
                query: undefined
            },
            {
                now: function () {
                    return 400
                }
            }
        )

        expect(saved).toEqual({
            values: {
                enabled: true,
                count: 5,
                tags: ['saved']
            },
            meta: {
                savedAt: 400
            }
        })
    })

    it('maps values before saving', function () {
        const saved = writeStoredForm<TestValues>(
            'settings',
            {
                query: '   padded   ',
                enabled: false,
                count: 0,
                tags: []
            },
            {
                mapBeforeSave: function (values) {
                    return {
                        ...values,
                        query: typeof values.query === 'string' ? values.query.trim() : values.query
                    }
                }
            }
        )

        expect(saved?.values.query).toBe('padded')
    })

    it('supports sessionStorage separately from localStorage', function () {
        writeStoredForm<TestValues>(
            'settings',
            {
                query: 'session only'
            },
            {
                storage: 'sessionStorage',
                now: function () {
                    return 500
                }
            }
        )

        expect(localStorage.getItem('settings')).toBeNull()
        expect(readStoredForm<TestValues>('settings', { storage: 'sessionStorage' })).toEqual({
            values: {
                query: 'session only'
            },
            meta: {
                savedAt: 500
            }
        })
        expect(readRawStorageJson('settings', sessionStorage)).toEqual({
            values: {
                query: 'session only'
            },
            meta: {
                savedAt: 500
            }
        })
    })

    it('removes one stored form', function () {
        writeStoredForm<TestValues>('settings', { query: 'to remove' })

        removeStoredForm('settings')

        expect(readStoredForm<TestValues>('settings')).toBeNull()
    })

    it('removes selected value keys from an existing stored envelope', function () {
        writeStoredForm<TestValues>(
            'settings',
            {
                query: 'keep',
                enabled: true,
                count: 5,
                tags: ['remove']
            },
            {
                now: function () {
                    return 600
                }
            }
        )

        const saved = removeStoredValueKeys<TestValues>('settings', ['enabled', 'tags'])

        expect(saved).toEqual({
            values: {
                query: 'keep',
                count: 5
            },
            meta: {
                savedAt: 600
            }
        })
        expect(readStoredForm<TestValues>('settings')).toEqual(saved)
    })

    it('clears keys by one prefix', function () {
        localStorage.setItem('form:a', '1')
        localStorage.setItem('form:b', '2')
        localStorage.setItem('other:a', '3')

        clearStorageKeys('form:')

        expect(localStorage.getItem('form:a')).toBeNull()
        expect(localStorage.getItem('form:b')).toBeNull()
        expect(localStorage.getItem('other:a')).toBe('3')
    })

    it('clears keys by multiple prefixes', function () {
        localStorage.setItem('form:a', '1')
        localStorage.setItem('settings:a', '2')
        localStorage.setItem('other:a', '3')

        clearStorageKeys(['form:', 'settings:'])

        expect(localStorage.getItem('form:a')).toBeNull()
        expect(localStorage.getItem('settings:a')).toBeNull()
        expect(localStorage.getItem('other:a')).toBe('3')
    })
})
