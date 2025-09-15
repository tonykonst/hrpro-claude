import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        navigator: 'readonly',
        URLSearchParams: 'readonly',
        WebSocket: 'readonly',
        AudioContext: 'readonly',
        MediaStream: 'readonly',
        ScriptProcessorNode: 'readonly',
        AudioWorkletNode: 'readonly',
        AnalyserNode: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        fetch: 'readonly',
        HTMLElement: 'readonly',
        KeyboardEvent: 'readonly',
        
        // Node.js globals
        process: 'readonly',
        __dirname: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        NodeJS: 'readonly',
        
        // Electron globals
        ipcRenderer: 'readonly',
        contextBridge: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': typescript,
      'react': react,
      'react-hooks': reactHooks
    },
    rules: {
      // TypeScript rules
      '@typescript-eslint/no-explicit-any': 'warn', // Changed from error to warn
      '@typescript-eslint/no-unused-vars': 'warn', // Changed from error to warn
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      
      // React rules
      'react/react-in-jsx-scope': 'off', // Not needed in React 17+
      'react/prop-types': 'off', // Using TypeScript for prop validation
      'react-hooks/exhaustive-deps': 'warn', // Changed from error to warn
      
      // General rules
      'no-console': 'warn',
      'no-debugger': 'error',
      'prefer-const': 'warn', // Changed from error to warn
      'no-var': 'warn', // Changed from error to warn
      'no-unused-vars': 'warn' // Added for compatibility
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    ignores: [
      'dist/',
      'node_modules/',
      '*.js',
      '*.d.ts',
      'build/',
      'coverage/',
      '.env*'
    ]
  }
];
