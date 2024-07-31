module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', {jsxRuntime: 'automatic'}]],
    plugins: [
      // Allow sql imports so that we can bundle drizzle migrations.
      [
        'inline-import',
        {
          extensions: ['.sql'],
        },
      ],
      'react-native-reanimated/plugin',
      [
        '@tamagui/babel-plugin',
        {
          config: './tamagui.config.ts',
          components: ['@tloncorp/ui', 'tamagui'],
          experimentalFlattenThemesOnNative: true,
        },
      ],
    ],
  };
};
