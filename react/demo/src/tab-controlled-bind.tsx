import { useFormSaver } from 'form-saver-react'
import { type ChangeEvent, useCallback, useMemo } from 'react'

import {
    DebugPanel,
    type DemoSettings,
    initialSettings,
    STORAGE_KEYS,
    useStorageDebug
} from './demo-shared'

export const ControlledBindTab = () => {
    const storageKey = STORAGE_KEYS['controlled-bind']
    const { savedJson, refreshSavedJson } = useStorageDebug(storageKey)

    const form = useFormSaver<DemoSettings>({
        storageKey,
        initialValues: initialSettings,
        debounceMs: 150,
        mergeUnknownKeys: true,
        urlHash: true,
        onRestore: refreshSavedJson,
        onSave: refreshSavedJson,
        onError: (error: unknown): void => {
            console.error('FormSaver controlled demo error:', error)
        }
    })

    const statusText = useMemo((): string => {
        if (!form.hasRestored) {
            return 'Restoring saved controlled values...'
        }

        return 'Ready. Controlled values are synchronized with localStorage and the URL hash.'
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
        refreshSavedJson()
    }, [form, refreshSavedJson])

    const handleClearStorage = useCallback((): void => {
        form.clearStoredValues()
        form.clearUrlHashValues()
        refreshSavedJson()
    }, [form, refreshSavedJson])

    const handleSaveNow = useCallback((): void => {
        form.saveNow()
        refreshSavedJson()
    }, [form, refreshSavedJson])

    return (
        <section className="tab-content">
            <div className="status-row">
                <span>{statusText}</span>
            </div>
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
                            Clear storage and hash
                        </button>
                    </div>
                </form>

                <DebugPanel
                    title="Controlled debug"
                    storageKey={storageKey}
                    restoredAt={form.restoredAt}
                    lastSavedAt={form.lastSavedAt}
                    stateLabel="Current React state"
                    currentState={form.values}
                    savedJson={savedJson}
                />
            </section>
        </section>
    )
}
