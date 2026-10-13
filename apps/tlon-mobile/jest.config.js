module.exports = {
  moduleNameMapper: {
    // mock react-native-svg-transformer
    // https://github.com/kristerkari/react-native-svg-transformer?tab=readme-ov-file#usage-with-jest
    '\\.svg': '<rootDir>/src/test/reactNativeSvgTransformerMock.ts',
    // @tloncorp/api's "." export map has no require/default condition, so
    // jest's CJS resolution can't find it. Point it at the same source Metro
    // resolves through the package's tlon-source condition.
    '^@tloncorp/api$': '<rootDir>/../../packages/api/src/index.ts',
  },
  preset: 'jest-expo',
  // react-native-worklets (pulled in by reanimated) only loads under jest with
  // its `.native` variants filtered out; without this its module registry
  // blows up as soon as anything imports @tloncorp/ui.
  resolver: 'react-native-worklets/jest/resolver',
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
