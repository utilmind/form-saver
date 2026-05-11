/**
 * SSR-safety tests for React hooks.
 *
 * Rendering to string does not run effects, so these tests make sure the public
 * hooks do not touch browser-only APIs during render. That is the key Next.js
 * constraint for server components importing client components that use the
 * library internally.
 */

import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { useFormSaver } from '../src/useFormSaver'
import { useFormSaverDom } from '../src/useFormSaverDom'

const ControlledComponent = () => {
    useFormSaver({
        storageKey: 'ssr-controlled',
        initialValues: {
            title: ''
        }
    })

    return createElement('div')
}

const DomComponent = () => {
    useFormSaverDom({
        storageKey: 'ssr-dom'
    })

    return createElement('form')
}

describe('React SSR safety', () => {
    it('renders the controlled hook to string without browser storage', () => {
        expect(() => renderToString(createElement(ControlledComponent))).not.toThrow()
    })

    it('renders the DOM hook to string without browser storage', () => {
        expect(() => renderToString(createElement(DomComponent))).not.toThrow()
    })
})
