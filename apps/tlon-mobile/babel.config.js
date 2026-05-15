module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
    plugins: [
      // Allow sql imports so that we can bundle drizzle migrations.
      [
        'inline-import',
        {
          extensions: ['.sql'],
        },
      ],
      [
        '@tamagui/babel-plugin',
        {
          config: './tamagui.config.ts',
          components: ['@tloncorp/ui', 'tamagui'],
          experimentalFlattenThemesOnNative: true,
        },
      ],
      'react-native-worklets/plugin',
    ],
  };
};
