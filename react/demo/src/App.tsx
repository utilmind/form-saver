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

import { useCallback, useEffect, useRef, useState } from 'react'

import { AppLink } from './app-link'
import {
    DEFAULT_DEMO_TAB,
    type DemoPage,
    readDemoPageFromLocation,
    readDemoTabFromLocation,
    writeAboutPageToLocation,
    writeDemoTabToLocation
} from './demo-location'
import { type DemoTab, type RegisterDemoTabSave } from './demo-shared'
import { ControlledBindTab } from './tab-controlled-bind'
import { DomHookTab } from './tab-dom-hook'
import { ScopeComponentTab } from './tab-scope-component'

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

interface DemoContentProps {
    activeTab: DemoTab
    onSelectTab: (tab: DemoTab) => void
    registerActiveTabSave: RegisterDemoTabSave
}

const DemoContent = ({ activeTab, onSelectTab, registerActiveTabSave }: DemoContentProps) => {
    const activeDescription = demoTabs.find((tab) => tab.id === activeTab)?.description

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
                            onSelectTab(tab.id)
                        }}
                    >
                        <span>{tab.label}</span>
                        <small>{tab.description}</small>
                    </button>
                ))}
            </nav>

            {activeDescription && <p className="tab-summary">{activeDescription}</p>}

            {activeTab === DEFAULT_DEMO_TAB && (
                <ControlledBindTab registerSave={registerActiveTabSave} />
            )}
            {activeTab === 'dom-hook' && <DomHookTab registerSave={registerActiveTabSave} />}
            {activeTab === 'scope-component' && (
                <ScopeComponentTab registerSave={registerActiveTabSave} />
            )}
        </main>
    )
}

interface AboutContentProps {
    onViewDemo: () => void
}

const AboutContent = ({ onViewDemo }: AboutContentProps) => (
    <main className="about-page">
        <div className="about-content">
            <p>
                <strong>FormSaver</strong>, React hook package
                <br />
                (c) 2008–2026,{' '}
                <a
                    href="https://github.com/utilmind/form-saver/"
                    className="outlink"
                    target="_blank"
                    rel="noreferrer"
                >
                    utilmind
                </a>
            </p>

            <p>
                <AppLink href="/" onNavigate={onViewDemo}>
                    View demo
                </AppLink>
            </p>
        </div>
    </main>
)

export const App = () => {
    const [page, setPage] = useState<DemoPage>(() => readDemoPageFromLocation())
    const [activeTab, setActiveTab] = useState<DemoTab>(() => readDemoTabFromLocation())
    const saveActiveTabRef = useRef<(() => void) | null>(null)

    useEffect(() => {
        const handlePopState = (): void => {
            const nextPage = readDemoPageFromLocation()

            setPage(nextPage)
            if (nextPage === 'demo') {
                setActiveTab(readDemoTabFromLocation())
            }
        }

        window.addEventListener('popstate', handlePopState)

        return () => {
            window.removeEventListener('popstate', handlePopState)
        }
    }, [])

    const registerActiveTabSave = useCallback<RegisterDemoTabSave>((saveNow): void => {
        saveActiveTabRef.current = saveNow
    }, [])

    const handleSelectTab = useCallback(
        (tab: DemoTab): void => {
            if (tab === activeTab) {
                return
            }

            // Flush debounced form changes before the active tab unmounts.
            saveActiveTabRef.current?.()
            writeDemoTabToLocation(tab)
            setActiveTab(tab)
        },
        [activeTab]
    )

    const handleViewAbout = useCallback((): void => {
        if (page === 'about') {
            return
        }

        // Persist the current form before removing its settings from the URL.
        saveActiveTabRef.current?.()
        writeAboutPageToLocation()
        setPage('about')
    }, [page])

    const handleViewDemo = useCallback((): void => {
        if (page === 'demo') {
            return
        }

        writeDemoTabToLocation(activeTab)
        setPage('demo')
    }, [activeTab, page])

    return (
        <div className="site-shell">
            {page === 'demo' ? (
                <DemoContent
                    activeTab={activeTab}
                    onSelectTab={handleSelectTab}
                    registerActiveTabSave={registerActiveTabSave}
                />
            ) : (
                <AboutContent onViewDemo={handleViewDemo} />
            )}

            <footer className="site-navigation" aria-label="Demo pages">
                <AppLink
                    href="/"
                    aria-current={page === 'demo' ? 'page' : undefined}
                    onNavigate={handleViewDemo}
                >
                    Demo
                </AppLink>
                <span aria-hidden="true">|</span>
                <AppLink
                    href="/about/"
                    aria-current={page === 'about' ? 'page' : undefined}
                    onNavigate={handleViewAbout}
                >
                    About
                </AppLink>
            </footer>
        </div>
    )
}
