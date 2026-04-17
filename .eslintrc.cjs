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
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'tamagui',
            importNames: ['ZStack'],
            message:
              'Import ZStack from @tloncorp/ui instead. The repo uses a local native-safe implementation.',
          },
          {
            name: '@tamagui/stacks',
            importNames: ['ZStack'],
            message:
              'Import ZStack from @tloncorp/ui instead. The repo uses a local native-safe implementation.',
          },
        ],
      },
    ],
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
        // `navigation.navigate('ChatList' | 'Activity' | 'Contacts' | 'Settings', …)`.
        // Also matches TS casts like `navigate('ChatList' as never)`, which
        // wrap the literal in a TSAsExpression.
        // The escape hatch requires an ObjectExpression third argument
        // containing `pop: true` (including quoted `"pop"` keys).
        selector:
          'CallExpression[callee.property.name="navigate"]' +
          ':matches(' +
          '[arguments.0.value=/^(ChatList|Activity|Contacts|Settings)$/],' +
          '[arguments.0.expression.value=/^(ChatList|Activity|Contacts|Settings)$/]' +
          ')' +
          ':not(:matches(' +
          '[arguments.2.type="ObjectExpression"]:has(Property[key.name="pop"][value.value=true]),' +
          '[arguments.2.type="ObjectExpression"]:has(Property[key.value="pop"][value.value=true])' +
          '))',
        message:
          "navigate() to a top-level tab route must pass { pop: true } as the third argument. React Navigation 7's navigate() pushes a new screen by default — without pop:true this causes duplicate screen mounts and perceived input delay on Android. See TLON-5598.",
      },
      {
        // Destructured `navigate('ChatList' | ...)` (e.g. `const { navigate } = props.navigation`).
        // Requires an ObjectExpression third argument containing
        // `pop: true` (including quoted `"pop"` keys).
        selector:
          'CallExpression[callee.name="navigate"]' +
          ':matches(' +
          '[arguments.0.value=/^(ChatList|Activity|Contacts|Settings)$/],' +
          '[arguments.0.expression.value=/^(ChatList|Activity|Contacts|Settings)$/]' +
          ')' +
          ':not(:matches(' +
          '[arguments.2.type="ObjectExpression"]:has(Property[key.name="pop"][value.value=true]),' +
          '[arguments.2.type="ObjectExpression"]:has(Property[key.value="pop"][value.value=true])' +
          '))',
        message:
          "navigate() to a top-level tab route must pass { pop: true } as the third argument. React Navigation 7's navigate() pushes a new screen by default — without pop:true this causes duplicate screen mounts and perceived input delay on Android. See TLON-5598.",
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
