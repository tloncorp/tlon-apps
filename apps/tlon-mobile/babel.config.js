module.exports = function (api) {
  api.cache.using(() => process.env.NODE_ENV);
  const config = {
    presets: [['babel-preset-expo', { jsxRuntime: 'automatic' }]],
    plugins: [
      // Allow sql imports so that we can bundle drizzle migrations.
      [
        'inline-import',
        {
          extensions: ['.sql'],
        },
      ],
      'react-native-reanimated/plugin',

      !api.env('test') && [
        '@tamagui/babel-plugin',
        {
          config: './tamagui.config.ts',
          components: ['@tloncorp/ui', 'tamagui'],
          experimentalFlattenThemesOnNative: true,
        },
      ],
    ]
      // Remove all falsy values
      .filter(Boolean),
  };

  return config;
};
