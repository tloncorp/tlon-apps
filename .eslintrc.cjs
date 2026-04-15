const path = require('path');

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
    "import-x/parsers": {
      "@typescript-eslint/parser": [".ts", ".tsx"],
    },
    "import-x/resolver": {
      "typescript": true,
    },
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import-x'],
  ignorePatterns: ['dist', 'node_modules', '*.md'],
  overrides: [
    {
      files: ['**/*.test.{ts,tsx}'],
      rules: {
        'import-x/no-restricted-paths': 'off',
      },
    },
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
                group: ['@tloncorp/shared', '@tloncorp/shared/*'],
                message:
                  'API package boundaries: imports from @tloncorp/shared are not allowed.',
              },
            ],
          },
        ],
      },
    },
  ],
  rules: {
    'import-x/no-cycle': 'error',
    'import-x/no-restricted-paths': [
      'error',
      {
        basePath: __dirname,
        zones: [
          // api/ submodules (top is forbidden from import from lower):
          // - lib
          // - http-api
          // - urbit
          // - client
          ...importBoundaries({
            basePath: './packages/api/src',
            zones: {
              'lib': { forbidImportFrom: ['http-api', 'urbit', 'client'] },
              'http-api': { forbidImportFrom: ['urbit', 'client'] },
              'urbit': { forbidImportFrom: ['client'] },
            },
          }),
          // shared/ submodules (top is forbidden from import from lower):
          // - utils
          // - logic
          // - db
          // - store
          ...importBoundaries({
            basePath: './packages/shared/src',
            zones: {
              'utils': { forbidImportFrom: ['logic', 'db', 'store'] },
              'logic': { forbidImportFrom: ['db', 'store'] },
              'db': { forbidImportFrom: ['store'] },
            },
          }),
        ],
      },
    ],
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
    ],
  },
};

/**
 * @param opts An object containing the options for the import boundaries.
 * @param opts.basePath The base path to resolve the target and from paths against.
 * @param opts.zones An object where the keys are target paths and the values are objects with a forbidImportFrom array of paths that cannot import from the target.
 * @returns An array of rules for the import-x/no-restricted-paths rule.
 */
function importBoundaries(opts) {
  const rules = [];
  for (const [target, { forbidImportFrom }] of Object.entries(opts.zones)) {
    for (const from of forbidImportFrom) {
      rules.push({
        target: path.join(opts.basePath, target),
        from: path.join(opts.basePath, from),
      });
    }
  }
  return rules;
}
