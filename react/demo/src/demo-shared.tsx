import type { FormSaverValuesConstraint, useFormSaver } from 'form-saver-react'
import { useCallback, useEffect, useState } from 'react'

export type DemoTab = 'controlled-bind' | 'dom-hook' | 'scope-component'
export type DemoMode = 'basic' | 'advanced' | 'expert'
export type DemoDensity = 'comfortable' | 'compact' | 'dense'
export type CustomReviewLevel = 'quick' | 'full'

export interface DemoSettings {
    searchQuery: string
    emailNotifications: boolean
    mode: DemoMode
    density: DemoDensity
    tags: string[]
    resultsPerPage: number
    notes: string
}

export interface NativeDemoSettings {
    projectName: string
    emailNotifications: boolean
    mode: DemoMode
    density: DemoDensity
    features: string[]
    tags: string[]
    notes: string
}

export interface CustomAddonSettings {
    customReviewed: boolean
    customReviewLevel: CustomReviewLevel
}

export type RegisterDemoTabSave = (saveNow: (() => void) | null) => void

export const STORAGE_KEYS: Record<DemoTab, string> = {
    'controlled-bind': 'form-saver-demo-controlled',
    'dom-hook': 'form-saver-demo-dom-hook',
    'scope-component': 'form-saver-demo-scope'
}

export const initialSettings: DemoSettings = {
    searchQuery: '',
    emailNotifications: false,
    mode: 'basic',
    density: 'comfortable',
    tags: [],
    resultsPerPage: 20,
    notes: ''
}

export const initialNativeSettings: NativeDemoSettings = {
    projectName: '',
    emailNotifications: false,
    mode: 'basic',
    density: 'comfortable',
    features: [],
    tags: [],
    notes: ''
}

export const initialCustomAddon: CustomAddonSettings = {
    customReviewed: false,
    customReviewLevel: 'quick'
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

export const useStorageDebug = <TValues extends FormSaverValuesConstraint<TValues>>(
    storageKey: string
) => {
    const [savedJson, setSavedJson] = useState<string>('Loading...')

    const refreshSavedJson = useCallback((): void => {
        setSavedJson(readSavedJson(storageKey))
    }, [storageKey])

    const handleFormSaved = useCallback((): void => {
        refreshSavedJson()
    }, [refreshSavedJson])

    useEffect(() => {
        refreshSavedJson()
    }, [refreshSavedJson])

    return {
        savedJson,
        refreshSavedJson,
        handleFormSaved
    }
}

export const useRegisterDemoTabSave = (
    registerSave: RegisterDemoTabSave,
    saveNow: () => void
): void => {
    useEffect(() => {
        registerSave(saveNow)

        return () => {
            registerSave(null)
        }
    }, [registerSave, saveNow])
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

export const DebugPanel = ({
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

export const CustomAddon = ({ form }: CustomAddonProps) => (
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

export const renderNativeSettingsControls = (idPrefix: string) => (
    <>
        <div className="form-row">
            <label htmlFor={`${idPrefix}-projectName`}>Project name</label>
            <input
                id={`${idPrefix}-projectName`}
                name="projectName"
                type="text"
                placeholder="Type and reload the page..."
                defaultValue={initialNativeSettings.projectName}
            />
        </div>

        <div className="form-row checkbox-row">
            <label>
                <input
                    type="checkbox"
                    name="emailNotifications"
                    defaultChecked={initialNativeSettings.emailNotifications}
                />
                Enable email notifications
            </label>
        </div>

        <fieldset className="form-row radio-group">
            <legend>Mode</legend>
            <label>
                <input
                    type="radio"
                    name="mode"
                    value="basic"
                    defaultChecked={initialNativeSettings.mode === 'basic'}
                />
                Basic
            </label>
            <label>
                <input
                    type="radio"
                    name="mode"
                    value="advanced"
                    defaultChecked={initialNativeSettings.mode === 'advanced'}
                />
                Advanced
            </label>
            <label>
                <input
                    type="radio"
                    name="mode"
                    value="expert"
                    defaultChecked={initialNativeSettings.mode === 'expert'}
                />
                Expert
            </label>
        </fieldset>

        <div className="form-row">
            <label htmlFor={`${idPrefix}-density`}>Density</label>
            <select
                id={`${idPrefix}-density`}
                name="density"
                defaultValue={initialNativeSettings.density}
            >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
                <option value="dense">Dense</option>
            </select>
        </div>

        <fieldset className="form-row radio-group">
            <legend>Features</legend>
            <label>
                <input
                    type="checkbox"
                    name="features"
                    value="ocr"
                    defaultChecked={initialNativeSettings.features.includes('ocr')}
                />
                OCR
            </label>
            <label>
                <input
                    type="checkbox"
                    name="features"
                    value="llm"
                    defaultChecked={initialNativeSettings.features.includes('llm')}
                />
                LLM
            </label>
            <label>
                <input
                    type="checkbox"
                    name="features"
                    value="geo"
                    defaultChecked={initialNativeSettings.features.includes('geo')}
                />
                Geo lookup
            </label>
        </fieldset>

        <div className="form-row">
            <label htmlFor={`${idPrefix}-tags`}>Tags</label>
            <select
                id={`${idPrefix}-tags`}
                name="tags"
                multiple
                size={4}
                defaultValue={initialNativeSettings.tags}
            >
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
                defaultValue={initialNativeSettings.notes}
            />
        </div>
    </>
)
