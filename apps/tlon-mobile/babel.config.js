module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Allow sql imports so that we can bundle drizzle migrations.
      [
        'inline-import',
        {
          extensions: ['.sql'],
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};
