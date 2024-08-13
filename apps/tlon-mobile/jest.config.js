module.exports = {
  moduleNameMapper: {
    // mock react-native-svg-transformer
    // https://github.com/kristerkari/react-native-svg-transformer?tab=readme-ov-file#usage-with-jest
    '\\.svg': '<rootDir>/src/test/reactNativeSvgTransformerMock.ts',
  },
  preset: 'jest-expo',
  setupFiles: ['./src/test/jestSetup.tsx'],
  transform: {
    // from babel-jest-preset
    '^.+\\.(js|ts|tsx)$': 'babel-jest',

    // from babel-jest-preset
    '^.+\\.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp|ttf|otf|m4v|mov|mp4|mpeg|mpg|webm|aac|aiff|caf|m4a|mp3|wav|html|pdf|obj)$':
      require.resolve('jest-expo/src/preset/assetFileTransformer.js'),
  },
  transformIgnorePatterns: [
    '/node_modules/\\@urbit/sigil-js/',
    '\\.pnp\\.[^\\/]+$',
  ],
  testMatch: ['**/__uitests__/**/*.[jt]s?(x)'],
};
