import tseslint from '@electron-toolkit/eslint-config-ts';
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier';
import eslintPluginReact from 'eslint-plugin-react';
import eslintPluginReactHooks from 'eslint-plugin-react-hooks';
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/out',
      '**/scripts',
      '**/worker',
      '**/assets',
      '**/*.d.ts',
      '**/*.cjs',
      '**/notarize.js',
      '**/coverage',
      '**/__snapshots__',
      '**/cypress',
      '**/*.cy.ts*',
      '**/.eslintrc.js',
      '**/wallaby.js',
    ],
  },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh,
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/require-returns-type': 'off',
      'no-unused-vars': 'off',
      'no-case-declarations': 'off',
    },
  },
  eslintConfigPrettier
);
