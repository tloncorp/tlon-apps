module.exports = {
  rules: {
    'no-restricted-imports': [
      'error',
      { patterns: ['@tloncorp/app', 'tlon-mobile', 'tlon-web'] },
    ],
  },
};
