/**
 * Synchronous page-unload persistence helpers.
 *
 * Browsers can write storage during beforeunload, but a last-second history
 * replacement may not become the URL used for the following reload. To avoid
 * restoring a stale hash over the freshly saved focused field, FormSaver keeps
 * a small per-form marker in sessionStorage and checks it during restoration.
 */

import { getStorage } from './storage'
import type {
    BrowserStorageName,
    FormSaverValue,
    FormSaverValuesConstraint,
    StoredFormSaverData
} from './types'

const PAGE_UNLOAD_MARKERS_KEY = 'form-saver-react:page-unload-markers'

type PageUnloadMarker = {
    fieldName: string
    savedAt: number
}

type PageUnloadMarkers = Partial<Record<string, PageUnloadMarker>>

type PageUnloadSaveResult = {
    meta: {
        savedAt: number
    }
} | null

interface SubscribeToPageUnloadOptions {
    storageKey: string
    storage: BrowserStorageName
    trackUrlHash: boolean
    save: () => PageUnloadSaveResult
    ownsField: (fieldName: string, activeElement: Element) => boolean
}

const getMarkerId = (storageKey: string, storage: BrowserStorageName): string =>
    JSON.stringify([storage, storageKey])

const readMarkers = (): PageUnloadMarkers => {
    const storage = getStorage('sessionStorage')
    if (!storage) {
        return {}
    }

    try {
        const raw = storage.getItem(PAGE_UNLOAD_MARKERS_KEY)
        if (!raw) {
            return {}
        }

        const parsed = JSON.parse(raw) as unknown
        return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
        return {}
    }
}

const writeMarker = (
    storageKey: string,
    storageName: BrowserStorageName,
    marker: PageUnloadMarker | null
): void => {
    const storage = getStorage('sessionStorage')
    if (!storage) {
        return
    }

    try {
        const markers = readMarkers()
        const markerId = getMarkerId(storageKey, storageName)

        if (marker) {
            markers[markerId] = marker
        } else {
            delete markers[markerId]
        }

        if (Object.keys(markers).length) {
            storage.setItem(PAGE_UNLOAD_MARKERS_KEY, JSON.stringify(markers))
        } else {
            storage.removeItem(PAGE_UNLOAD_MARKERS_KEY)
        }
    } catch {
        // sessionStorage is best-effort and may be unavailable in private contexts.
    }
}

const readMarker = (
    storageKey: string,
    storageName: BrowserStorageName
): PageUnloadMarker | null => {
    const marker = readMarkers()[getMarkerId(storageKey, storageName)]

    return marker && typeof marker.fieldName === 'string' && typeof marker.savedAt === 'number'
        ? marker
        : null
}

const scheduleMarkerRemoval = (
    storageKey: string,
    storageName: BrowserStorageName,
    marker: PageUnloadMarker
): void => {
    setTimeout(() => {
        const currentMarker = readMarker(storageKey, storageName)

        if (
            currentMarker &&
            currentMarker.fieldName === marker.fieldName &&
            currentMarker.savedAt === marker.savedAt
        ) {
            writeMarker(storageKey, storageName, null)
        }
    }, 0)
}

const getNamedActiveControl = (): { element: Element; fieldName: string } | null => {
    if (typeof document === 'undefined') {
        return null
    }

    const element = document.activeElement
    if (
        !(
            element instanceof HTMLInputElement ||
            element instanceof HTMLTextAreaElement ||
            element instanceof HTMLSelectElement
        ) ||
        !element.name
    ) {
        return null
    }

    return {
        element,
        fieldName: element.name
    }
}

const areValuesEqual = (
    first: FormSaverValue | undefined,
    second: FormSaverValue | undefined
): boolean => {
    if (!Array.isArray(first) || !Array.isArray(second)) {
        return Object.is(first, second)
    }

    if (first.length !== second.length) {
        return false
    }

    for (let index = 0; index < first.length; ++index) {
        if (!Object.is(first[index], second[index])) {
            return false
        }
    }

    return true
}

export const subscribeToPageUnload = (options: SubscribeToPageUnloadOptions): (() => void) => {
    if (typeof window === 'undefined') {
        return () => undefined
    }

    const handleBeforeUnload = (): void => {
        const activeControl = getNamedActiveControl()
        const ownedFieldName =
            activeControl && options.ownsField(activeControl.fieldName, activeControl.element)
                ? activeControl.fieldName
                : null
        const saved = options.save()

        if (!options.trackUrlHash) {
            return
        }

        writeMarker(
            options.storageKey,
            options.storage,
            saved && ownedFieldName
                ? {
                      fieldName: ownedFieldName,
                      savedAt: saved.meta.savedAt
                  }
                : null
        )
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload)
    }
}

export const shouldPreferStorageAfterPageUnload = <
    TValues extends FormSaverValuesConstraint<TValues>
>(
    storageKey: string,
    storageName: BrowserStorageName,
    hashValues: Partial<TValues>,
    stored: StoredFormSaverData<TValues>
): boolean => {
    const marker = readMarker(storageKey, storageName)
    if (!marker) {
        return false
    }

    scheduleMarkerRemoval(storageKey, storageName, marker)

    if (marker.savedAt !== stored.meta.savedAt) {
        return false
    }

    const fieldName = marker.fieldName as keyof TValues
    if (areValuesEqual(hashValues[fieldName], stored.values[fieldName])) {
        return false
    }

    for (const key in hashValues) {
        if (key !== marker.fieldName && !areValuesEqual(hashValues[key], stored.values[key])) {
            return false
        }
    }

    return true
}
