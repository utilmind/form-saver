/**
 * Small in-memory Storage implementation for hook tests.
 *
 * Newer Node versions may expose their own global localStorage implementation,
 * and that can conflict with jsdom/Vitest. Hook tests need deterministic
 * browser storage, so we install explicit Storage instances on both window and
 * globalThis before each test.
 */

class TestMemoryStorage implements Storage {
    private readonly keys: string[] = []
    private readonly items: Record<string, string> = {}

    get length(): number {
        return this.keys.length
    }

    clear(): void {
        this.keys.length = 0

        for (const key in this.items) {
            delete this.items[key]
        }
    }

    getItem(key: string): string | null {
        return Object.prototype.hasOwnProperty.call(this.items, key) ? this.items[key] : null
    }

    key(index: number): string | null {
        return this.keys[index] || null
    }

    removeItem(key: string): void {
        if (Object.prototype.hasOwnProperty.call(this.items, key)) {
            delete this.items[key]
            const index = this.keys.indexOf(key)

            if (index !== -1) {
                this.keys.splice(index, 1)
            }
        }
    }

    setItem(key: string, value: string): void {
        if (!Object.prototype.hasOwnProperty.call(this.items, key)) {
            this.keys.push(key)
        }

        this.items[key] = String(value)
    }
}

const defineStorage = (name: 'localStorage' | 'sessionStorage', storage: Storage): void => {
    Object.defineProperty(window, name, {
        configurable: true,
        value: storage
    })

    Object.defineProperty(globalThis, name, {
        configurable: true,
        value: storage
    })
}

export const installTestBrowserStorage = (): {
    localStorage: Storage
    sessionStorage: Storage
} => {
    const localStorage = new TestMemoryStorage()
    const sessionStorage = new TestMemoryStorage()

    defineStorage('localStorage', localStorage)
    defineStorage('sessionStorage', sessionStorage)

    return {
        localStorage,
        sessionStorage
    }
}
