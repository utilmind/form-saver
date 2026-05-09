/**
 * Vitest configuration for the React package test suite.
 *
 * Tests currently focus on the library source and use explicit browser-storage
 * stubs instead of relying on a full browser environment. Keep this config small
 * and package-local so CI and local development run the same test set.
 */

import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        include: ['test/**/*.test.ts'],
        clearMocks: true,
        restoreMocks: true,
        unstubGlobals: true
    }
})
