import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import reactPlugin from 'eslint-plugin-react';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import packageJson from 'eslint-plugin-package-json';
import jsdoc from 'eslint-plugin-jsdoc';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

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
    plugins: {
      prettier: eslintPluginPrettier,
      jsdoc,
      'simple-import-sort': simpleImportSort,
      react: reactPlugin,
    },
    rules: {
      'react-hooks/set-state-in-effect': 'error',
      'prettier/prettier': 'error',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'react/forbid-component-props': ['error', { forbid: ['style'] }],
      'react/forbid-dom-props': ['error', { forbid: ['style'] }],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXAttribute Literal[value=/^(#|rgba?\(|hsla?\()/]',
          message:
            'Raw color literals (hex, rgb, rgba, hsl, hsla) are forbidden in JSX attributes. Use CSS classes and CSS variable theme tokens instead.',
        },
      ],
      'jsdoc/require-description': [
        'error',
        {
          contexts: [
            'ClassDeclaration',
            'MethodDefinition',
            'TSInterfaceDeclaration',
            'TSTypeAliasDeclaration',
            'TSEnumDeclaration',
            'ExportNamedDeclaration > FunctionDeclaration',
            'ExportDefaultDeclaration > FunctionDeclaration',
            'ExportNamedDeclaration > VariableDeclarator > ArrowFunctionExpression',
          ],
        },
      ],
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          require: {
            ArrowFunctionExpression: true,
            ClassDeclaration: true,
            FunctionDeclaration: true,
            MethodDefinition: true,
          },
          contexts: ['TSInterfaceDeclaration', 'TSTypeAliasDeclaration', 'TSEnumDeclaration'],
        },
      ],
    },
  },
  eslintConfigPrettier,
  packageJson.configs.recommended,
]);
