const baseConfig = require('../../.prettierrc.json');

module.exports = {
  ...baseConfig,
  plugins: ['prettier-plugin-tailwindcss', ...(baseConfig.plugins || [])],
  tailwindConfig: './tailwind.config.js',
};
