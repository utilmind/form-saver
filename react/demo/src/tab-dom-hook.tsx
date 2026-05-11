import { useFormSaver, useFormSaverDom } from 'form-saver-react'
import { type FormEvent, useCallback } from 'react'

import {
    CustomAddon,
    type CustomAddonSettings,
    DebugPanel,
    initialCustomAddon,
    renderNativeSettingsControls,
    STORAGE_KEYS,
    useStorageDebug
} from './demo-shared'

export const DomHookTab = () => {
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
