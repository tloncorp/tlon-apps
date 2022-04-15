module.exports = {
  extends: '@tloncorp/eslint-config',
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
    'react/jsx-filename-extension': [1, { extensions: ['.jsx', '.tsx'] }],
    'tailwindcss/no-custom-classname': [
      0,
      {
        config: 'tailwind.config.js',
      },
    ],
  },
}
