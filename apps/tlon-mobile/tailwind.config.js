module.exports = {
  content: [
    './src/**/*.js',
    './src/**/*.jsx',
    './src/**/*.ts',
    './src/**/*.tsx',
  ],
  theme: {
    extend: {
      colors: {
        'tlon-black-90': '#1A1A1A',
        'tlon-black-80': '#333333',
        'tlon-black-70': '#4C4C4C',
        'tlon-black-60': '#666666',
        'tlon-black-50': '#808080',
        'tlon-black-40': '#999999',
        'tlon-black-30': '#B3B3B3',
        'tlon-black-20': '#CCCCCC',
        'tlon-black-10': '#E5E5E5',
        'tlon-blue': '#3099E2',
        'tlon-blue-active': '#1e8cd8',
        'tlon-red': '#FF6240',
        'tlon-soft-red': '#FFEFEC',
      },
    },
  },
  plugins: [],
  corePlugins: require('tailwind-rn/unsupported-core-plugins'),
};
