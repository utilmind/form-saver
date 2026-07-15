import { type FormSaverValues, readStoredForm } from 'form-saver-react'

import { serializeFormValuesToUrlHash } from '../../src/urlHash'
import { type DemoTab, INITIAL_VALUES_BY_TAB, STORAGE_KEYS } from './demo-shared'

const DEMO_QUERY_PARAM = 'demo'
export const DEFAULT_DEMO_TAB: DemoTab = 'controlled-bind'

const isDemoTab = (value: string | null): value is DemoTab =>
    value === 'controlled-bind' || value === 'dom-hook' || value === 'scope-component'

const readDemoValues = (tab: DemoTab): FormSaverValues =>
    readStoredForm<FormSaverValues>(STORAGE_KEYS[tab])?.values ?? INITIAL_VALUES_BY_TAB[tab]

const createDemoUrl = (tab: DemoTab, currentUrl: string): URL => {
    const url = new URL(currentUrl)

    url.searchParams.set(DEMO_QUERY_PARAM, tab)
    url.hash = serializeFormValuesToUrlHash<FormSaverValues>(readDemoValues(tab))

    return url
}

export const readDemoTabFromLocation = (): DemoTab => {
    if (typeof window === 'undefined') {
        return DEFAULT_DEMO_TAB
    }

    const tab = new URLSearchParams(window.location.search).get(DEMO_QUERY_PARAM)

    return isDemoTab(tab) ? tab : DEFAULT_DEMO_TAB
}

export const writeDemoTabToLocation = (tab: DemoTab): void => {
    if (typeof window === 'undefined') {
        return
    }

    window.history.pushState(null, '', createDemoUrl(tab, window.location.href))
}

export const ensureDemoTabHash = (tab: DemoTab): void => {
    if (typeof window === 'undefined' || window.location.hash) {
        return
    }

    const url = new URL(window.location.href)

    url.hash = serializeFormValuesToUrlHash<FormSaverValues>(readDemoValues(tab))
    window.history.replaceState(null, '', url)
}
