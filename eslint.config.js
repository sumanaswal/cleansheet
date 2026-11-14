import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // shadcn/ui files export components together with style helpers.
    // This only affects hot-reload behaviour in dev, so we relax it here
    // and keep the rule active for all of our own code.
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Architecture rule: the cleaning engine is pure TypeScript.
    // It must never depend on React or on any UI, page, hook or worker code.
    files: ['src/engine/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'The engine must not depend on React.' },
            {
              name: 'react-dom',
              message: 'The engine must not depend on React.',
            },
          ],
          patterns: [
            {
              group: ['react/*', 'react-dom/*'],
              message: 'The engine must not depend on React.',
            },
            {
              group: [
                '**/components/**',
                '**/pages/**',
                '**/hooks/**',
                '**/workers/**',
              ],
              message:
                'The engine must not import UI, page, hook or worker code. Dependencies point toward the engine only.',
            },
          ],
        },
      ],
    },
  },
])