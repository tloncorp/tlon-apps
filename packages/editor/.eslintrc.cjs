module.exports = {
  rules: {
    'no-restricted-imports': [
      'error',
      { patterns: ['@tloncorp/*', 'tlon-mobile', 'tlon-web'] },
    ],
  },
};
