module.exports = {
  bracketSpacing: true,
  printWidth: 80,
  proseWrap: 'always',
  singleQuote: true,
  tabWidth: 2,
  useTabs: false,
  plugins: [
    'prettier-plugin-tailwindcss',
    '@trivago/prettier-plugin-sort-imports',
  ],
  overrides: [
    {
      files: ['*.html'],
      htmlWhitespaceSensitivity: 'ignore',
      // https://github.com/prettier/prettier-vscode/issues/646#issuecomment-514776589
    },
    {
      files: ['*.md'],
      options: {
        tabWidth: 4,
        printWidth: 1000,
      },
    },
    {
      files: ['package*.json'],
      options: {
        printWidth: 1000,
      },
    },
    {
      files: ['*.yml'],
      options: {
        singleQuote: false,
      },
    },
  ],
  tailwindConfig: './tailwind.config.js',
  semi: true,
  trailingComma: 'es5',
  importOrder: ['<THIRD_PARTY_MODULES>', '^[./]'],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
};
