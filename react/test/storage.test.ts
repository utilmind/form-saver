import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
    clearStorageKeys,
    getStorage,
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

class BlockingStorage implements Storage {
    get length(): number {
        throw new Error('Storage operation blocked')
    }

    clear(): void {
        throw new Error('Storage operation blocked')
    }

    getItem(): string | null {
        throw new Error('Storage operation blocked')
    }

    key(): string | null {
        throw new Error('Storage operation blocked')
    }

    removeItem(): void {
        throw new Error('Storage operation blocked')
    }

    setItem(): void {
        throw new Error('Storage operation blocked')
    }
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

const installBrowserStorage = (): { localStorage: Storage; sessionStorage: Storage } => {
    const localStorage = new MemoryStorage()
    const sessionStorage = new MemoryStorage()

    vi.stubGlobal('window', {
        localStorage,
        sessionStorage
    })

    return { localStorage, sessionStorage }
}

const readRawStorageJson = (storageKey: string, storage: Storage): unknown => {
    const raw = storage.getItem(storageKey)

    return raw ? JSON.parse(raw) : null
}

describe('storage helper', () => {
    let localStorage: Storage
    let sessionStorage: Storage

    beforeEach(() => {
        const storages = installBrowserStorage()

        localStorage = storages.localStorage
        sessionStorage = storages.sessionStorage
    })

    it('returns null and ignores writes/removals when browser storage is unavailable', () => {
        vi.unstubAllGlobals()

        expect(getStorage()).toBeNull()
        expect(readStoredForm<TestValues>('settings')).toBeNull()
        expect(writeStoredForm<TestValues>('settings', { query: 'ignored' })).toBeNull()

        expect(() => {
            removeStoredForm('settings')
            clearStorageKeys('settings:')
        }).not.toThrow()
    })

    it('ignores storage operation errors when browser storage exists but is blocked', () => {
        vi.stubGlobal('window', {
            localStorage: new BlockingStorage(),
            sessionStorage: new BlockingStorage()
        })

        expect(readStoredForm<TestValues>('settings')).toBeNull()
        expect(writeStoredForm<TestValues>('settings', { query: 'ignored' })).toBeNull()

        expect(() => {
            removeStoredForm('settings')
            removeStoredValueKeys<TestValues>('settings', ['query'])
            clearStorageKeys('settings:')
        }).not.toThrow()
    })

    it('writes and reads one JSON envelope with values and metadata', () => {
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
                now: () => 123456
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

    it('returns null for missing, invalid, or unsupported stored data', () => {
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

    it('preserves unknown keys by default when saving partial values', () => {
        writeStoredForm<TestValues>(
            'shared-form',
            {
                query: 'first page',
                enabled: true,
                count: 10,
                tags: ['a']
            },
            {
                now: () => 100
            }
        )

        const saved = writeStoredForm<TestValues>(
            'shared-form',
            {
                query: 'second page'
            },
            {
                now: () => 200
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

    it('can replace stored values instead of preserving unknown keys', () => {
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
                now: () => 300
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

    it('deletes a value when the next partial value is undefined', () => {
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
                now: () => 400
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

    it('maps values before saving', () => {
        const saved = writeStoredForm<TestValues>(
            'settings',
            {
                query: '   padded   ',
                enabled: false,
                count: 0,
                tags: []
            },
            {
                mapBeforeSave: (values) => ({
                    ...values,
                    query: typeof values.query === 'string' ? values.query.trim() : values.query
                })
            }
        )

        expect(saved?.values.query).toBe('padded')
    })

    it('supports sessionStorage separately from localStorage', () => {
        writeStoredForm<TestValues>(
            'settings',
            {
                query: 'session only'
            },
            {
                storage: 'sessionStorage',
                now: () => 500
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

    it('removes one stored form', () => {
        writeStoredForm<TestValues>('settings', { query: 'to remove' })

        removeStoredForm('settings')

        expect(readStoredForm<TestValues>('settings')).toBeNull()
    })

    it('removes selected value keys from an existing stored envelope', () => {
        writeStoredForm<TestValues>(
            'settings',
            {
                query: 'keep',
                enabled: true,
                count: 5,
                tags: ['remove']
            },
            {
                now: () => 600
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

    it('clears keys by one prefix', () => {
        localStorage.setItem('form:a', '1')
        localStorage.setItem('form:b', '2')
        localStorage.setItem('other:a', '3')

        clearStorageKeys('form:')

        expect(localStorage.getItem('form:a')).toBeNull()
        expect(localStorage.getItem('form:b')).toBeNull()
        expect(localStorage.getItem('other:a')).toBe('3')
    })

    it('clears keys by multiple prefixes', () => {
        localStorage.setItem('form:a', '1')
        localStorage.setItem('settings:a', '2')
        localStorage.setItem('other:a', '3')

        clearStorageKeys(['form:', 'settings:'])

        expect(localStorage.getItem('form:a')).toBeNull()
        expect(localStorage.getItem('settings:a')).toBeNull()
        expect(localStorage.getItem('other:a')).toBe('3')
    })
})
