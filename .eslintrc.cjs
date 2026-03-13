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
  plugins: ['@typescript-eslint'],
  ignorePatterns: ['dist', 'node_modules', '*.md'],
  overrides: [
    {
      files: ['packages/api/src/**/*.{ts,tsx}'],
      excludedFiles: [
        'packages/api/src/**/__tests__/**',
        'packages/api/src/**/test/**',
      ],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@tloncorp/*'],
                message:
                  'API package boundaries: imports from @tloncorp/* are not allowed.',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['packages/api/src/**/*.{ts,tsx}'],
      excludedFiles: [
        'packages/api/src/**/__tests__/**',
        'packages/api/src/**/test/**',
        'packages/api/src/client/systemContactsApi.native.ts',
        'packages/api/src/client/upload.ts',
        'packages/api/src/types/attachment.ts',
        'packages/api/src/urbit/settings.ts',
      ],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@tloncorp/*'],
                message:
                  'API package boundaries: imports from @tloncorp/* are not allowed.',
              },
              {
                group: [
                  'react',
                  'expo-*',
                  'tamagui',
                  'zustand',
                  '@aws-sdk/*',
                ],
                message:
                  'API core boundaries: runtime/UI adapter dependencies must live outside API core.',
              },
            ],
          },
        ],
      },
    },
  ],
  rules: {
    '@typescript-eslint/consistent-type-imports': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-namespace': 'off',
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
    'react-hooks/exhaustive-deps': [
      'warn',
      {
        additionalHooks: '(useAnimatedStyle|useDerivedValue|useAnimatedProps)',
      },
    ],
    'no-restricted-syntax': [
      'error',
      {
        selector: 'CallExpression[callee.name="getToken"]',
        message:
          'Please use getTokenValue() instead of getToken() to ensure web compatibility. See: https://tamagui.dev/docs/core/exports#gettokenvalue',
      },
      {
        selector:
          'JSXOpeningElement[name.name=/^(Stack|XStack|YStack|View|ListItem)$/] > JSXAttribute[name.name="onPress"]',
        message:
          'Do not use onPress on Stack, View or ListItem components. Use Pressable instead.',
      },
      {
        selector:
          'JSXOpeningElement[name.name=/^(Stack|XStack|YStack|View|ListItem)$/] > JSXAttribute[name.name="onLongPress"]',
        message:
          'Do not use onLongPress on Stack, View or ListItem components. Use Pressable instead.',
      },
      {
        selector:
          'MemberExpression[object.name="CommonActions"][property.name="reset"]',
        message:
          'Please use the useTypedReset() hook instead of CommonActions.reset() for type safety.',
      },
      {
        // Also catch it when imported as a different name
        selector:
          'ImportSpecifier[imported.name="reset"][parent.parent.source.value="@react-navigation/native"]',
        message:
          'Please use the useTypedReset() hook instead of importing reset from @react-navigation/native for type safety.',
      },
      {
        selector: 'ImportDeclaration > Literal[value=/^packages/]',
        message:
          'Do not import directly from the "packages" directory. Use the package name (or relative path, if within the same package) instead.',
      },
    ],
  },
};
