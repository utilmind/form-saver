// ESLint flat config for the React + TypeScript module.
// Formatting is handled by Prettier; ESLint focuses on correctness and code quality.

import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import js from '@eslint/js'
import prettierConfig from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import tseslint from 'typescript-eslint'

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url))

const TS_FILES = [
    'src/**/*.{ts,tsx}',
    'test/**/*.{ts,tsx}',
    'demo/src/**/*.{ts,tsx}',
    'demo/vite.config.ts',
    'vitest.config.ts'
]

export default [
    {
        ignores: [
            'dist/**',
            'coverage/**',
            'node_modules/**',
            'demo/dist/**',
            'demo/node_modules/**'
        ]
    },

    js.configs.recommended,

    ...tseslint.configs.recommendedTypeChecked.map(function (config) {
        return {
            ...config,
            files: TS_FILES
        }
    }),

    {
        files: TS_FILES,
        languageOptions: {
            parserOptions: {
                project: ['./tsconfig.eslint.json'],
                tsconfigRootDir
            }
        },
        plugins: {
            'react-hooks': reactHooks,
            'simple-import-sort': simpleImportSort
        },
        rules: {
            // TypeScript already checks undefined variables better than ESLint for TS files.
            'no-undef': 'off',

            // React hooks correctness.
            ...reactHooks.configs.recommended.rules,

            // Practical TypeScript hygiene.
            '@typescript-eslint/consistent-type-imports': [
                'warn',
                {
                    prefer: 'type-imports',
                    fixStyle: 'separate-type-imports'
                }
            ],
            '@typescript-eslint/no-non-null-assertion': 'warn',
            '@typescript-eslint/no-unnecessary-condition': 'warn',
            '@typescript-eslint/switch-exhaustiveness-check': 'error',

            // Import ordering and duplicate protection.
            'no-duplicate-imports': 'error',
            'simple-import-sort/imports': 'warn',
            'simple-import-sort/exports': 'warn',

            // Sensible baseline.
            eqeqeq: ['error', 'smart'],
            'no-console': 'off',
            'no-debugger': 'error',
            'prefer-const': 'error'
        }
    },

    // Keep this last so ESLint never fights Prettier formatting.
    prettierConfig
]
