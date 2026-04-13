module.exports = {
  rules: {
    'import-x/no-cycle': 'off',
    'no-restricted-imports': [
      'error',
      { patterns: ['tlon-mobile', 'tlon-web'] },
    ],
  },
};
