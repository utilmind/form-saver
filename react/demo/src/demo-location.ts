import { type DemoTab } from './demo-shared'

const DEMO_QUERY_PARAM = 'demo'
const ABOUT_PATHNAME = '/about/'
const DEMO_PATHNAME = '/'

export type DemoPage = 'demo' | 'about'
export const DEFAULT_DEMO_TAB: DemoTab = 'controlled-bind'

const isDemoTab = (value: string | null): value is DemoTab =>
    value === 'controlled-bind' || value === 'dom-hook' || value === 'scope-component'

const normalizePathname = (pathname: string): string =>
    pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname

const createDemoUrl = (tab: DemoTab, currentUrl: string): URL => {
    // Resolving a new pathname creates a clean destination URL without
    // inheriting the current page's query string or hash fragment.
    const url = new URL(DEMO_PATHNAME, currentUrl)

    url.searchParams.set(DEMO_QUERY_PARAM, tab)

    return url
}

const createAboutUrl = (currentUrl: string): URL => new URL(ABOUT_PATHNAME, currentUrl)

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
