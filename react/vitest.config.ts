/**
 * Vitest configuration for the React package test suite.
 *
 * Tests currently focus on the library source and use explicit browser-storage
 * stubs instead of relying on a full browser environment. The local package
 * alias also lets integration tests exercise the Vite demo against current
 * source files without requiring a package build first.
 */

import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
    resolve: {
        dedupe: ['react', 'react-dom'],
        alias: {
            'form-saver-react': fileURLToPath(new URL('./src/index.ts', import.meta.url))
        }
    },
    test: {
        include: ['test/**/*.test.{ts,tsx}'],
        clearMocks: true,
        restoreMocks: true,
        unstubGlobals: true
    }
})
