/* eslint-env node */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: [
      './tsconfig.json',
      './packages/*/tsconfig.json',
      './apps/*/tsconfig.json',
    ],
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint'],
  ignorePatterns: ['dist', 'node_modules'],
  rules: {
    '@typescript-eslint/consistent-type-imports': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
    ],
    'react/no-unescaped-entities': 'warn',
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react/display-name': 'warn',
    'no-useless-escape': 'warn',
  },
};
