import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'form-saver-react': resolve(currentDir, '../src/index.ts'),
    },
  },
  server: {
    fs: {
      // Allow the demo app to import the local module sources from ../src.
      allow: [resolve(currentDir, '..')],
    },
  },
});
