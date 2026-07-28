import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Build output — dist/ and the Vercel build artifacts are minified bundles that
  // produce thousands of meaningless errors when linted.
  globalIgnores(['dist', '.vercel', 'build', 'coverage']),

  // Browser code.
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': [
        'error',
        { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' },
      ],
      // `try { localStorage… } catch {}` is deliberate throughout the mock-mode
      // helpers: a quota error or private-browsing block is not worth surfacing.
      'no-empty': ['error', { allowEmptyCatch: true }],

      // These flag real issues, but clearing them is a render-behaviour refactor
      // across most pages rather than a mechanical fix. Kept visible as warnings
      // so the error gate below is meaningful today; burn them down separately.
      // TODO(callsheet): 52 set-state-in-effect sites — see review 2026-07-27.
      'react-hooks/set-state-in-effect': 'warn',

      // The context files intentionally export a provider alongside its hook
      // (AuthContext, NotificationContext, ThemeContext). That is the idiomatic
      // pattern; the cost is only slower HMR, so it should not fail the build.
      'react-refresh/only-export-components': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },

  // Server code: Vercel Functions, the Express app, scripts, and tests all run on
  // Node and need Node globals (process, Buffer, console, ...).
  {
    files: ['api/**/*.js', 'server/**/*.js', 'scripts/**/*.mjs', 'tests/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  // Service worker / static scripts served from public/.
  {
    files: ['public/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.serviceworker, ...globals.browser },
    },
  },
])
