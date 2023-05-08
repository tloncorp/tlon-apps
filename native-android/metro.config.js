// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: false,
    nonInlinedRequires: [
      '@react-native-community/async-storage',
      'React',
      'react',
      'react-native',
    ]
  },
});

module.exports = config;
