module.exports = {
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          '@tloncorp/*',
          '!@tloncorp/api',
          '!@tloncorp/api/**',
          'tlon-mobile',
          'tlon-web',
        ],
      },
    ],
  },
};
