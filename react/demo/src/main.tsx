/**
 * Browser entry point for the Vite demo application.
 *
 * This file only mounts the demo React tree into the #root element from
 * demo/index.html. It should stay small so that App.tsx remains the place where
 * demo behavior and form-saver examples are maintained.
 */

import './styles.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'

const rootElement = document.getElementById('root')

if (!rootElement) {
    throw new Error('Root element #root was not found.')
}

createRoot(rootElement).render(
    <StrictMode>
        <App />
    </StrictMode>
)
