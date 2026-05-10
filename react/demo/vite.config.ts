/**
 * Vite configuration for the local demo app.
 *
 * The demo imports the package through the public name "form-saver-react", but
 * the alias below points that name at ../src/index.ts so development always uses
 * the current local source rather than a built npm package. The file-system
 * allow-list is intentionally widened to let Vite read the library source one
 * directory above the demo project.
 */

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const currentDir = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            'form-saver-react': resolve(currentDir, '../src/index.ts')
        }
    },
    server: {
        fs: {
            // Allow the demo app to import the local module sources from ../src.
            allow: [resolve(currentDir, '..')]
        }
    }
})
