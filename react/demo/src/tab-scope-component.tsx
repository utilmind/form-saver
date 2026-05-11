import {
    collectDomFormValues,
    FormSaverScope,
    removeStoredForm,
    useFormSaver,
    writeStoredForm
} from 'form-saver-react'
import { type FormEvent, useCallback, useRef } from 'react'

import {
    CustomAddon,
    type CustomAddonSettings,
    DebugPanel,
    initialCustomAddon,
    renderNativeSettingsControls,
    STORAGE_KEYS,
    useStorageDebug
} from './demo-shared'

export const ScopeComponentTab = () => {
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
