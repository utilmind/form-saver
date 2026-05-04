// Flat config for a Node.js TypeScript service (NodeNext).
// Formatting is handled by Prettier; ESLint focuses on correctness and code quality.

import js from '@eslint/js'
import prettierConfig from 'eslint-config-prettier'
import importPlugin from 'eslint-plugin-import'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import tseslint from 'typescript-eslint'
const TS_FILES = ['**/*.ts']

export default [
    // Ignore generated output and config itself
    {
        ignores: ['dist/**', 'node_modules/**', 'eslint.config.js'],
    },

    // Base JS rules (safe to apply globally)
    js.configs.recommended,

    // TypeScript: type-aware rule sets ONLY for TS files
    ...tseslint.configs.recommendedTypeChecked.map((cfg) => ({
        ...cfg,
        files: TS_FILES,
    })),
    ...tseslint.configs.stylisticTypeChecked.map((cfg) => ({
        ...cfg,
        files: TS_FILES,
    })),

    // Disable rules that conflict with Prettier
    prettierConfig,

    // TS rules
    {
        files: TS_FILES,
        languageOptions: {
            parserOptions: {
                project: ['./tsconfig.json'],
                tsconfigRootDir: process.cwd(),
                sourceType: 'module',
            },
        },
        plugins: {
            import: importPlugin,
            'simple-import-sort': simpleImportSort,
        },
        rules: {
            // High ROI for backend services
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-misused-promises': [
                'error',
                {
                    checksVoidReturn: {
                        // helps with common callback patterns
                        arguments: false,
                    },
                },
            ],
            '@typescript-eslint/switch-exhaustiveness-check': 'error',

            // Practical TS hygiene
            '@typescript-eslint/consistent-type-imports': [
                'warn',
                { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
            ],
            '@typescript-eslint/no-unnecessary-condition': 'warn',
            '@typescript-eslint/no-non-null-assertion': 'warn',

            // Imports quality
            'import/no-duplicates': 'error',
            'simple-import-sort/imports': 'warn',
            'simple-import-sort/exports': 'warn',

            // Sensible baseline
            eqeqeq: ['error', 'smart'],
            'no-debugger': 'error',
            'prefer-const': 'error',

            // For services, console logs are often acceptable (leave ON/OFF as you prefer)
            'no-console': 'off',
        },
    },
]