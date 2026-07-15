/**
 * Runs Vitest with Node's built-in Web Storage disabled when the runtime
 * supports it. Node 25+ exposes a global localStorage implementation that can
 * shadow jsdom's browser-compatible storage inside Vitest workers.
 */

import { spawnSync } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'

const vitestPath = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url))
const env = { ...process.env }

if (process.allowedNodeEnvironmentFlags.has('--no-webstorage')) {
    const nodeOptions = env.NODE_OPTIONS?.trim()

    if (!nodeOptions?.includes('--no-webstorage')) {
        env.NODE_OPTIONS = [nodeOptions, '--no-webstorage'].filter(Boolean).join(' ')
    }
}

const result = spawnSync(process.execPath, [vitestPath, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env
})

if (result.error) {
    throw result.error
}

process.exitCode = result.status ?? 1
