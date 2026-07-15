import { type FormSaverValues, readStoredForm } from 'form-saver-react'

import { serializeFormValuesToUrlHash } from '../../src/urlHash'
import { type DemoTab, INITIAL_VALUES_BY_TAB, STORAGE_KEYS } from './demo-shared'

const DEMO_QUERY_PARAM = 'demo'
const ABOUT_PATHNAME = '/about/'
const DEMO_PATHNAME = '/'

export type DemoPage = 'demo' | 'about'
export const DEFAULT_DEMO_TAB: DemoTab = 'controlled-bind'

const isDemoTab = (value: string | null): value is DemoTab =>
    value === 'controlled-bind' || value === 'dom-hook' || value === 'scope-component'

const normalizePathname = (pathname: string): string =>
    pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname

const readDemoValues = (tab: DemoTab): FormSaverValues =>
    readStoredForm<FormSaverValues>(STORAGE_KEYS[tab])?.values ?? INITIAL_VALUES_BY_TAB[tab]

const createDemoUrl = (tab: DemoTab, currentUrl: string): URL => {
    const url = new URL(currentUrl)

    url.pathname = DEMO_PATHNAME
    url.search = ''
    url.searchParams.set(DEMO_QUERY_PARAM, tab)
    url.hash = serializeFormValuesToUrlHash<FormSaverValues>(readDemoValues(tab))

    return url
}

const createAboutUrl = (currentUrl: string): URL => {
    const url = new URL(currentUrl)

    url.pathname = ABOUT_PATHNAME
    url.search = ''
    url.hash = ''

    return url
}

export const readDemoPageFromLocation = (): DemoPage => {
    if (typeof window === 'undefined') {
        return 'demo'
    }

    return normalizePathname(window.location.pathname) === normalizePathname(ABOUT_PATHNAME)
        ? 'about'
        : 'demo'
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

export const writeAboutPageToLocation = (): void => {
    if (typeof window === 'undefined') {
        return
    }

    window.history.pushState(null, '', createAboutUrl(window.location.href))
}

export const ensureDemoTabHash = (tab: DemoTab): void => {
    if (
        typeof window === 'undefined' ||
        readDemoPageFromLocation() !== 'demo' ||
        window.location.hash
    ) {
        return
    }

    window.history.replaceState(null, '', createDemoUrl(tab, window.location.href))
}
