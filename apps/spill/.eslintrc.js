module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    radix: 'off',
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'tamagui',
            importNames: [
              'Input',
              'Paragraph',
              'ScrollView',
              'Sheet',
              'SizableText',
              'Stack',
              'Switch',
              'Text',
              'TextArea',
              'XStack',
              'YStack',
              'Image',
            ],
            message: 'Please import from theme instead.',
          },
          {
            name: 'tamagui',
            importNames: ['ListItem', 'Avatar', 'Button', 'Sheet'],
            message: 'Please import from core instead.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['src/theme/**/*'],
      rules: {
        'no-restricted-imports': 'off',
      },
    },
  ],
  parserOptions: {
    requireConfigFile: false,
  },
};
