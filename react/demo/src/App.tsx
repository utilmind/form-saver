/**
 * Demo application for the local development playground.
 *
 * The demo intentionally shows all public React usage styles:
 * - controlled state via useFormSaver and bind helpers;
 * - DOM auto-binding via useFormSaverDom;
 * - DOM auto-binding via FormSaverScope with asChild.
 *
 * Developer notes:
 * - Treat this file as demo-only code, not part of the published library API.
 * - Keep the scenarios here aligned with the README examples and storage tests.
 */

import {
    collectDomFormValues,
    FormSaverScope,
    removeStoredForm,
    useFormSaver,
    useFormSaverDom,
    writeStoredForm
} from 'form-saver-react'
import {
    type ChangeEvent,
    type FormEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react'

const DEMO_QUERY_PARAM = 'demo'

type DemoTab = 'controlled-bind' | 'dom-hook' | 'scope-component'

const DEFAULT_DEMO_TAB: DemoTab = 'controlled-bind'

const STORAGE_KEYS: Record<DemoTab, string> = {
    'controlled-bind': 'form-saver-demo-controlled',
    'dom-hook': 'form-saver-demo-dom-hook',
    'scope-component': 'form-saver-demo-scope'
}
type DemoMode = 'basic' | 'advanced' | 'expert'
type DemoDensity = 'comfortable' | 'compact' | 'dense'

type CustomReviewLevel = 'quick' | 'full'

interface DemoSettings {
    searchQuery: string
    emailNotifications: boolean
    mode: DemoMode
    density: DemoDensity
    tags: string[]
    resultsPerPage: number
    notes: string
}

interface CustomAddonSettings {
    customReviewed: boolean
    customReviewLevel: CustomReviewLevel
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

const initialCustomAddon: CustomAddonSettings = {
    customReviewed: false,
    customReviewLevel: 'quick'
}

const demoTabs: Array<{ id: DemoTab; label: string; description: string }> = [
    {
        id: 'controlled-bind',
        label: '1. Controlled bind',
        description: 'Typed React state via useFormSaver and bind helpers.'
    },
    {
        id: 'dom-hook',
        label: '2. DOM hook',
        description: 'Attach useFormSaverDom to an uncontrolled form ref.'
    },
    {
        id: 'scope-component',
        label: '3. Scope component',
        description: 'Use FormSaverScope asChild without adding a wrapper element.'
    }
]

const isDemoTab = (value: string | null): value is DemoTab =>
    value === 'controlled-bind' || value === 'dom-hook' || value === 'scope-component'

const readDemoTabFromLocation = (): DemoTab => {
    if (typeof window === 'undefined') {
        return DEFAULT_DEMO_TAB
    }

    const tab = new URLSearchParams(window.location.search).get(DEMO_QUERY_PARAM)

    return isDemoTab(tab) ? tab : DEFAULT_DEMO_TAB
}

const writeDemoTabToLocation = (tab: DemoTab): void => {
    if (typeof window === 'undefined') {
        return
    }

    const url = new URL(window.location.href)
    url.searchParams.set(DEMO_QUERY_PARAM, tab)
    window.history.pushState(null, '', url)
}

const readSavedJson = (storageKey: string): string => {
    if (typeof window === 'undefined') {
        return 'Browser storage is not available during server rendering.'
    }

    try {
        const raw = window.localStorage.getItem(storageKey)

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

const useStorageDebug = (storageKey: string) => {
    const [savedJson, setSavedJson] = useState<string>('Loading...')

    const refreshSavedJson = useCallback((): void => {
        setSavedJson(readSavedJson(storageKey))
    }, [storageKey])

    useEffect(() => {
        refreshSavedJson()
    }, [refreshSavedJson])

    return {
        savedJson,
        refreshSavedJson
    }
}

interface DebugPanelProps {
    title: string
    storageKey: string
    savedJson: string
    restoredAt?: number
    lastSavedAt?: number
    stateLabel?: string
    currentState?: unknown
}

const DebugPanel = ({
    title,
    storageKey,
    savedJson,
    restoredAt,
    lastSavedAt,
    stateLabel,
    currentState
}: DebugPanelProps) => (
    <aside className="debug-card">
        <h2>{title}</h2>
        <dl>
            <div>
                <dt>Storage key</dt>
                <dd>
                    <code>{storageKey}</code>
                </dd>
            </div>
            <div>
                <dt>Restored at</dt>
                <dd>{formatTimestamp(restoredAt)}</dd>
            </div>
            <div>
                <dt>Last saved at</dt>
                <dd>{formatTimestamp(lastSavedAt)}</dd>
            </div>
        </dl>

        {stateLabel && currentState !== undefined && (
            <>
                <h3>{stateLabel}</h3>
                <pre>{JSON.stringify(currentState, null, 2)}</pre>
            </>
        )}

        <h3>Saved localStorage JSON</h3>
        <pre>{savedJson}</pre>
    </aside>
)

interface CustomAddonProps {
    form: ReturnType<typeof useFormSaver<CustomAddonSettings>>
}

const CustomAddon = ({ form }: CustomAddonProps) => (
    <fieldset className="form-row radio-group custom-addon">
        <legend>Controlled add-on saved with bind helpers</legend>
        <label className="checkbox-row-inline">
            <input
                data-form-saver-ignore
                type="checkbox"
                {...form.bind.checkbox('customReviewed')}
            />
            Mark this custom setting as reviewed
        </label>
        <div className="segmented-control" aria-label="Review level">
            <label>
                <input
                    data-form-saver-ignore
                    type="radio"
                    {...form.bind.radio('customReviewLevel', 'quick')}
                />
                <span>Quick</span>
            </label>
            <label>
                <input
                    data-form-saver-ignore
                    type="radio"
                    {...form.bind.radio('customReviewLevel', 'full')}
                />
                <span>Full</span>
            </label>
        </div>
        <small>
            These controls are ignored by DOM auto-binding and saved by the controlled bind API
            instead.
        </small>
    </fieldset>
)

const renderNativeSettingsControls = (idPrefix: string) => (
    <>
        <div className="form-row">
            <label htmlFor={`${idPrefix}-projectName`}>Project name</label>
            <input
                id={`${idPrefix}-projectName`}
                name="projectName"
                type="text"
                placeholder="Type and reload the page..."
                defaultValue=""
            />
        </div>

        <div className="form-row checkbox-row">
            <label>
                <input type="checkbox" name="emailNotifications" defaultChecked={false} />
                Enable email notifications
            </label>
        </div>

        <fieldset className="form-row radio-group">
            <legend>Mode</legend>
            <label>
                <input type="radio" name="mode" value="basic" defaultChecked />
                Basic
            </label>
            <label>
                <input type="radio" name="mode" value="advanced" />
                Advanced
            </label>
            <label>
                <input type="radio" name="mode" value="expert" />
                Expert
            </label>
        </fieldset>

        <div className="form-row">
            <label htmlFor={`${idPrefix}-density`}>Density</label>
            <select id={`${idPrefix}-density`} name="density" defaultValue="comfortable">
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
                <option value="dense">Dense</option>
            </select>
        </div>

        <fieldset className="form-row radio-group">
            <legend>Features</legend>
            <label>
                <input type="checkbox" name="features" value="ocr" />
                OCR
            </label>
            <label>
                <input type="checkbox" name="features" value="llm" />
                LLM
            </label>
            <label>
                <input type="checkbox" name="features" value="geo" />
                Geo lookup
            </label>
        </fieldset>

        <div className="form-row">
            <label htmlFor={`${idPrefix}-tags`}>Tags</label>
            <select id={`${idPrefix}-tags`} name="tags" multiple size={4} defaultValue={[]}>
                <option value="alpha">Alpha</option>
                <option value="beta">Beta</option>
                <option value="gamma">Gamma</option>
                <option value="delta">Delta</option>
            </select>
            <small>Hold Ctrl/Cmd to select multiple values.</small>
        </div>

        <div className="form-row">
            <label htmlFor={`${idPrefix}-notes`}>Notes</label>
            <textarea
                id={`${idPrefix}-notes`}
                name="notes"
                rows={5}
                placeholder="Write a note..."
                defaultValue=""
            />
        </div>
    </>
)

const ControlledBindDemo = () => {
    const storageKey = STORAGE_KEYS['controlled-bind']
    const { savedJson, refreshSavedJson } = useStorageDebug(storageKey)

    const form = useFormSaver<DemoSettings>({
        storageKey,
        initialValues: initialSettings,
        debounceMs: 150,
        mergeUnknownKeys: true,
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

        return 'Ready. Each field is controlled by React state and saved through bind helpers.'
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
                            Clear storage
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

const DomHookDemo = () => {
    const storageKey = STORAGE_KEYS['dom-hook']
    const { savedJson, refreshSavedJson } = useStorageDebug(storageKey)

    const domForm = useFormSaverDom<HTMLFormElement>({
        storageKey,
        debounceMs: 150,
        saveEvent: 'input',
        mergeUnknownKeys: true,
        onRestore: refreshSavedJson,
        onSave: refreshSavedJson,
        onError: (error: unknown): void => {
            console.error('FormSaver DOM hook demo error:', error)
        }
    })

    const customForm = useFormSaver<CustomAddonSettings>({
        storageKey,
        initialValues: initialCustomAddon,
        debounceMs: 150,
        mergeUnknownKeys: true,
        onRestore: refreshSavedJson,
        onSave: refreshSavedJson,
        onError: (error: unknown): void => {
            console.error('FormSaver DOM hook custom bind error:', error)
        }
    })

    const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>): void => {
        event.preventDefault()
    }, [])

    const handleSaveNow = useCallback((): void => {
        domForm.saveNow()
        customForm.saveNow()
        refreshSavedJson()
    }, [customForm, domForm, refreshSavedJson])

    const handleResetValues = useCallback((): void => {
        domForm.resetValues()
        customForm.resetValues()
        refreshSavedJson()
    }, [customForm, domForm, refreshSavedJson])

    const handleClearStorage = useCallback((): void => {
        domForm.clearStoredValues()
        refreshSavedJson()
    }, [domForm, refreshSavedJson])

    return (
        <section className="tab-content">
            <div className="status-row">
                <span>
                    This tab uses <code>useFormSaverDom</code>. Standard named controls are captured
                    automatically; the custom add-on is saved with bind helpers.
                </span>
            </div>
            <section className="layout-grid">
                <form ref={domForm.ref} className="settings-card" onSubmit={handleSubmit}>
                    {renderNativeSettingsControls('dom-hook')}
                    <CustomAddon form={customForm} />

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

                <DebugPanel
                    title="DOM hook debug"
                    storageKey={storageKey}
                    restoredAt={domForm.restoredAt || customForm.restoredAt}
                    lastSavedAt={domForm.lastSavedAt || customForm.lastSavedAt}
                    stateLabel="Controlled add-on state"
                    currentState={customForm.values}
                    savedJson={savedJson}
                />
            </section>
        </section>
    )
}

const ScopeComponentDemo = () => {
    const storageKey = STORAGE_KEYS['scope-component']
    const formRef = useRef<HTMLFormElement | null>(null)
    const { savedJson, refreshSavedJson } = useStorageDebug(storageKey)

    const customForm = useFormSaver<CustomAddonSettings>({
        storageKey,
        initialValues: initialCustomAddon,
        debounceMs: 150,
        mergeUnknownKeys: true,
        onRestore: refreshSavedJson,
        onSave: refreshSavedJson,
        onError: (error: unknown): void => {
            console.error('FormSaver scope custom bind error:', error)
        }
    })

    const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>): void => {
        event.preventDefault()
    }, [])

    const saveNativeControls = useCallback((): void => {
        const form = formRef.current

        if (form) {
            writeStoredForm(storageKey, collectDomFormValues(form), {
                mergeUnknownKeys: true
            })
        }
    }, [storageKey])

    const handleSaveNow = useCallback((): void => {
        saveNativeControls()
        customForm.saveNow()
        refreshSavedJson()
    }, [customForm, refreshSavedJson, saveNativeControls])

    const handleResetValues = useCallback((): void => {
        const form = formRef.current

        if (form) {
            form.reset()
            saveNativeControls()
        }

        customForm.resetValues()
        refreshSavedJson()
    }, [customForm, refreshSavedJson, saveNativeControls])

    const handleClearStorage = useCallback((): void => {
        removeStoredForm(storageKey)
        customForm.clearStoredValues()
        refreshSavedJson()
    }, [customForm, refreshSavedJson, storageKey])

    return (
        <section className="tab-content">
            <div className="status-row">
                <span>
                    This tab uses <code>{'<FormSaverScope asChild>'}</code>. The component clones
                    the form and attaches its ref without creating an extra DOM element.
                </span>
            </div>
            <section className="layout-grid">
                <FormSaverScope
                    asChild
                    storageKey={storageKey}
                    mergeUnknownKeys
                    onRestore={refreshSavedJson}
                    onSave={refreshSavedJson}
                    onError={(error: unknown): void => {
                        console.error('FormSaverScope demo error:', error)
                    }}
                >
                    <form ref={formRef} className="settings-card" onSubmit={handleSubmit}>
                        {renderNativeSettingsControls('scope')}
                        <CustomAddon form={customForm} />

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
                </FormSaverScope>

                <DebugPanel
                    title="Scope component debug"
                    storageKey={storageKey}
                    restoredAt={customForm.restoredAt}
                    lastSavedAt={customForm.lastSavedAt}
                    stateLabel="Controlled add-on state"
                    currentState={customForm.values}
                    savedJson={savedJson}
                />
            </section>
        </section>
    )
}

export const App = () => {
    const [activeTab, setActiveTab] = useState<DemoTab>(() => readDemoTabFromLocation())
    const activeDescription = demoTabs.find((tab) => tab.id === activeTab)?.description

    useEffect(() => {
        const handlePopState = (): void => {
            setActiveTab(readDemoTabFromLocation())
        }

        window.addEventListener('popstate', handlePopState)

        return () => {
            window.removeEventListener('popstate', handlePopState)
        }
    }, [])

    const handleSelectTab = useCallback((tab: DemoTab): void => {
        setActiveTab(tab)
        writeDemoTabToLocation(tab)
    }, [])

    return (
        <main className="app-shell">
            <section className="hero-card">
                <p className="eyebrow">FormSaver React Demo</p>
                <h1>Persist form settings in localStorage</h1>
                <p className="hero-text">
                    This Vite demo shows the three public React usage styles: controlled bind
                    helpers, DOM auto-binding through a hook, and the lightweight scope component.
                </p>
            </section>

            <nav className="tab-list" aria-label="FormSaver demo modes">
                {demoTabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        className={tab.id === activeTab ? 'tab-button is-active' : 'tab-button'}
                        aria-current={tab.id === activeTab ? 'page' : undefined}
                        onClick={() => {
                            handleSelectTab(tab.id)
                        }}
                    >
                        <span>{tab.label}</span>
                        <small>{tab.description}</small>
                    </button>
                ))}
            </nav>

            {activeDescription && <p className="tab-summary">{activeDescription}</p>}

            {activeTab === 'controlled-bind' && <ControlledBindDemo />}
            {activeTab === 'dom-hook' && <DomHookDemo />}
            {activeTab === 'scope-component' && <ScopeComponentDemo />}
        </main>
    )
}
