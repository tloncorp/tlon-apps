module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'transform-inline-environment-variables',
      {
        include: ['APP_ENV'],
      },
    ],
    [
      'module-resolver',
      {
        extensions: [
          '.ios.js',
          '.android.js',
          '.ios.jsx',
          '.android.jsx',
          '.js',
          '.jsx',
          '.json',
          '.ts',
          '.tsx',
        ],
        root: ['./'],
        alias: {
          '@api': './src/api',
          '@assets': './src/assets',
          '@components': './src/components',
          '@ochre': './src/components/ochre',
          '@db': './src/db',
          '@theme': './src/theme',
          '@utils': './src/utils',
        },
        logLevel: 'debug',
      },
    ],
    [
      '@tamagui/babel-plugin',
      {
        components: ['tamagui'],
        config: './tamagui.config.ts',
        logTimings: true,
        disableExtraction: false,
        experimentalFlattenThemesOnNative: true,
      },
    ],
    'react-native-reanimated/plugin',
  ],
};
