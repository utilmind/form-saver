import { useFormSaver } from 'form-saver-react'
import { type ChangeEvent, useCallback, useMemo, useState } from 'react'

const STORAGE_KEY = 'form-saver-react-demo-settings'

type DemoMode = 'basic' | 'advanced' | 'expert'
type DemoDensity = 'comfortable' | 'compact' | 'dense'

interface DemoSettings {
    searchQuery: string
    emailNotifications: boolean
    mode: DemoMode
    density: DemoDensity
    tags: string[]
    resultsPerPage: number
    notes: string
}

const initialSettings: DemoSettings = {
    searchQuery: '',
    emailNotifications: false,
    mode: 'basic',
    density: 'comfortable',
    tags: [],
    resultsPerPage: 20,
    notes: ''
}

const readSavedJson = (): string => {
    if (typeof window === 'undefined') {
        return 'Browser storage is not available during server rendering.'
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)

        if (!raw) {
            return 'Nothing saved yet.'
        }

        try {
            return JSON.stringify(JSON.parse(raw) as unknown, null, 2)
        } catch {
            return raw
        }
    } catch {
        return 'Browser storage exists but cannot be read in this context.'
    }
}

const formatTimestamp = (timestamp: number | undefined): string =>
    timestamp ? new Date(timestamp).toLocaleString() : 'never'

export const App = () => {
    const [savedJson, setSavedJson] = useState<string>('Loading...')

    const refreshSavedJson = useCallback((): void => {
        setSavedJson(readSavedJson())
    }, [])

    const form = useFormSaver<DemoSettings>({
        storageKey: STORAGE_KEY,
        initialValues: initialSettings,
        debounceMs: 150,
        mergeUnknownKeys: true,
        onRestore: refreshSavedJson,
        onSave: refreshSavedJson,
        onError: (error: unknown): void => {
            // Keep demo errors visible without interrupting the UI.
            console.error('FormSaver demo error:', error)
        }
    })

    const statusText = useMemo((): string => {
        if (!form.hasRestored) {
            return 'Restoring saved values...'
        }

        return 'Ready. Change any field and the state will be saved automatically.'
    }, [form.hasRestored])

    const handleResultsPerPageChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>): void => {
            const nextValue = Number(event.target.value)

            form.setValue('resultsPerPage', Number.isFinite(nextValue) ? nextValue : 0)
        },
        [form]
    )

    const handleResetValues = useCallback((): void => {
        form.resetValues()
    }, [form])

    const handleClearStorage = useCallback((): void => {
        form.clearStoredValues()
        refreshSavedJson()
    }, [form, refreshSavedJson])

    const handleSaveNow = useCallback((): void => {
        form.saveNow()
        refreshSavedJson()
    }, [form, refreshSavedJson])

    return (
        <main className="app-shell">
            <section className="hero-card">
                <p className="eyebrow">FormSaver React Demo</p>
                <h1>Persist form settings in localStorage</h1>
                <p className="hero-text">
                    This Vite demo exercises the React/TypeScript hook with text inputs, checkbox,
                    radio buttons, select, multi-select, number input, and textarea.
                </p>
                <div className="status-row">
                    <span>{statusText}</span>
                </div>
            </section>

            <section className="layout-grid">
                <form
                    className="settings-card"
                    onSubmit={(event) => {
                        event.preventDefault()
                    }}
                >
                    <div className="form-row">
                        <label htmlFor="searchQuery">Search query</label>
                        <input
                            id="searchQuery"
                            type="text"
                            placeholder="Type something..."
                            {...form.bind.text('searchQuery')}
                        />
                    </div>

                    <div className="form-row checkbox-row">
                        <label>
                            <input type="checkbox" {...form.bind.checkbox('emailNotifications')} />
                            Enable email notifications
                        </label>
                    </div>

                    <fieldset className="form-row radio-group">
                        <legend>Mode</legend>
                        <label>
                            <input type="radio" {...form.bind.radio('mode', 'basic')} />
                            Basic
                        </label>
                        <label>
                            <input type="radio" {...form.bind.radio('mode', 'advanced')} />
                            Advanced
                        </label>
                        <label>
                            <input type="radio" {...form.bind.radio('mode', 'expert')} />
                            Expert
                        </label>
                    </fieldset>

                    <div className="form-row">
                        <label htmlFor="density">Density</label>
                        <select id="density" {...form.bind.select('density')}>
                            <option value="comfortable">Comfortable</option>
                            <option value="compact">Compact</option>
                            <option value="dense">Dense</option>
                        </select>
                    </div>

                    <div className="form-row">
                        <label htmlFor="tags">Tags</label>
                        <select id="tags" size={4} {...form.bind.multiSelect('tags')}>
                            <option value="alpha">Alpha</option>
                            <option value="beta">Beta</option>
                            <option value="gamma">Gamma</option>
                            <option value="delta">Delta</option>
                        </select>
                        <small>Hold Ctrl/Cmd to select multiple values.</small>
                    </div>

                    <div className="form-row">
                        <label htmlFor="resultsPerPage">Results per page</label>
                        <input
                            id="resultsPerPage"
                            type="number"
                            min="1"
                            max="100"
                            value={form.values.resultsPerPage}
                            onChange={handleResultsPerPageChange}
                        />
                    </div>

                    <div className="form-row">
                        <label htmlFor="notes">Notes</label>
                        <textarea
                            id="notes"
                            rows={5}
                            placeholder="Write a note..."
                            {...form.bind.textarea('notes')}
                        />
                    </div>

                    <div className="button-row">
                        <button type="button" onClick={handleSaveNow}>
                            Save now
                        </button>
                        <button type="button" onClick={handleResetValues}>
                            Reset values
                        </button>
                        <button
                            type="button"
                            className="danger-button"
                            onClick={handleClearStorage}
                        >
                            Clear storage
                        </button>
                    </div>
                </form>

                <aside className="debug-card">
                    <h2>Debug</h2>
                    <dl>
                        <div>
                            <dt>Storage key</dt>
                            <dd>
                                <code>{STORAGE_KEY}</code>
                            </dd>
                        </div>
                        <div>
                            <dt>Restored at</dt>
                            <dd>{formatTimestamp(form.restoredAt)}</dd>
                        </div>
                        <div>
                            <dt>Last saved at</dt>
                            <dd>{formatTimestamp(form.lastSavedAt)}</dd>
                        </div>
                    </dl>

                    <h3>Current React state</h3>
                    <pre>{JSON.stringify(form.values, null, 2)}</pre>

                    <h3>Saved localStorage JSON</h3>
                    <pre>{savedJson}</pre>
                </aside>
            </section>
        </main>
    )
}
