module.exports = {
  extends: ['@tloncorp/eslint-config'],
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      parserOptions: {
        project: ['tsconfig.json'],
        tsconfigRootDir: __dirname,
      },
      rules: {
        'import/no-unresolved': [
          'error',
          { ignore: ['^@', '^virtual:pwa-register'] },
        ],
        'import/no-extraneous-dependencies': [
          'error',
          { devDependencies: true },
        ],
      },
    },
  ],
  rules: {
    semi: [2, 'always'],
    'react/destructuring-assignment': 'off',
    'react/require-default-props': 'off',
    'react/no-unstable-nested-components': ['error', { allowAsProps: true }],
    'react/jsx-filename-extension': [
      1,
      {
        extensions: ['.jsx', '.tsx'],
      },
    ],
    'react/jsx-key': 'warn',
    'tailwindcss/no-custom-classname': [
      0,
      {
        config: 'tailwind.config.js',
      },
    ],
    'no-param-reassign': [
      'error',
      { props: true, ignorePropertyModificationsFor: ['draft'] },
    ],
    'no-use-before-define': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
    ],
  },
  settings: {
    tailwindcss: {
      officialSorting: true,
    },
    'import/resolver': {
      alias: {
        // mapping big-integer and fuzzy to a non-existent to squash error described here:
        // https://github.com/johvin/eslint-import-resolver-alias/issues/18
        map: [
          ['@', './src'],
          ['big-integer', 'hack'],
          ['fuzzy', 'hack'],
          ['vitest', 'hack'],
        ],
        extensions: ['.ts', '.tsx', '.js'],
      },
    },
  },
};
