module.exports = {
  rules: {
    'import-x/no-cycle': 'warn',
    'no-restricted-imports': [
      'error',
      { patterns: ['tlon-mobile', 'tlon-web'] },
    ],
  },
};
