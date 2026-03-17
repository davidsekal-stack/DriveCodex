import js from '@eslint/js'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  js.configs.recommended,
  {
    plugins: {
      react:         reactPlugin,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      ecmaVersion:  2022,
      sourceType:   'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        window:    'readonly',
        document:  'readonly',
        navigator: 'readonly',
        console:   'readonly',
        fetch:     'readonly',
        setTimeout:'readonly',
        clearTimeout: 'readonly',
        localStorage: 'readonly',
        URL:       'readonly',
        Blob:      'readonly',
        atob:      'readonly',
        btoa:      'readonly',
        crypto:    'readonly',
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // React
      'react/jsx-uses-react':             'error',
      'react/jsx-uses-vars':              'error',
      'react/prop-types':                 'off',   // nepoužíváme PropTypes
      'react/react-in-jsx-scope':         'off',   // React 17+ nepotřebuje import

      // Hooks
      'react-hooks/rules-of-hooks':       'error',
      'react-hooks/exhaustive-deps':      'warn',

      // Obecné — varování, ne chyby (nechceme blokovat deploy kvůli stylingu)
      'no-unused-vars':    ['warn', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
      'no-console':        'off',
      'no-undef':          'error',
      'no-duplicate-case': 'error',
      'no-unreachable':        'warn',
      'no-empty':              ['error', { allowEmptyCatch: true }],
      'no-useless-assignment': 'warn',
      'eqeqeq':            ['warn', 'smart'],
    },
  },
  {
    // Ignoruj build výstupy a node_modules
    ignores: ['dist/**', 'node_modules/**', 'vite.config.js'],
  },
]
