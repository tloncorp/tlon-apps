module.exports = {
  extends: ['@tloncorp/eslint-config', 'plugin:storybook/recommended'],
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      parserOptions: {
        project: 'tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
  ],
  rules: {
    semi: [2, 'always'],
    'react/destructuring-assignment': 'off',
    'react/require-default-props': 'off',
    'react/jsx-filename-extension': [
      1,
      {
        extensions: ['.jsx', '.tsx'],
      },
    ],
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
    '@typescript-eslint/no-use-before-define': [
      'error',
      {
        typedefs: false,
      },
    ],
  },
  settings: {
    tailwindcss: {
      officialSorting: true,
    },
    'import/resolver': {
      'eslint-import-resolver-custom-alias': {
        alias: {
          '@': './src',
        },
        extensions: ['.ts', '.tsx'],
      },
    },
  },
};
