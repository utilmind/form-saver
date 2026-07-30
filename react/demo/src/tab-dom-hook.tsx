import { type FormSaverValues, useFormSaver, useFormSaverDom } from 'form-saver-react'
import { type FormEvent, useCallback } from 'react'

import {
    CustomAddon,
    type CustomAddonSettings,
    DebugPanel,
    initialCustomAddon,
    type RegisterDemoTabSave,
    renderNativeSettingsControls,
    STORAGE_KEYS,
    useRegisterDemoTabSave,
    useStorageDebug
} from './demo-shared'

interface DomHookTabProps {
    registerSave: RegisterDemoTabSave
}

export const DomHookTab = ({ registerSave }: DomHookTabProps) => {
    const storageKey = STORAGE_KEYS['dom-hook']
    const { savedJson, refreshSavedJson, handleFormSaved } =
        useStorageDebug<FormSaverValues>(storageKey)

    const domForm = useFormSaverDom<HTMLFormElement>({
        storageKey,
        debounceMs: 150,
        mergeUnknownKeys: true,
        urlHash: true,
        onRestore: refreshSavedJson,
        onSave: handleFormSaved,
        onError: (error: unknown): void => {
            console.error('FormSaver DOM hook demo error:', error)
        }
    })

    const customForm = useFormSaver<CustomAddonSettings>({
        storageKey,
        initialValues: initialCustomAddon,
        debounceMs: 150,
        mergeUnknownKeys: true,
        urlHash: true,
        onRestore: refreshSavedJson,
        onSave: handleFormSaved,
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
        domForm.clearUrlHashValues()
        refreshSavedJson()
    }, [domForm, refreshSavedJson])

    useRegisterDemoTabSave(registerSave, handleSaveNow)

    return (
        <section className="tab-content">
            <div className="status-row">
                <span>
                    This tab uses <code>useFormSaverDom</code>. Standard named controls are captured
                    automatically. Text fields use change/blur plus the 30-second focused autosave;
                    the custom add-on uses bind helpers.
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
                            Clear storage and hash
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
