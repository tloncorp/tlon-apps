module.exports = {
  extends: '@tloncorp/eslint-config',
  overrides: [
      {
          files: ['**/*.ts', '**/*.tsx'],
          parserOptions: {
              project: './tsconfig.json',
          },
      },
  ],
}
