// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const { mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const config = getDefaultConfig(projectRoot);

module.exports = mergeConfig(config, {
  watchFolders: [workspaceRoot],
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: false,
        nonInlinedRequires: [
          '@react-native-community/async-storage',
          'React',
          'react',
          'react-native',
        ],
      },
    }),
  },
  resolver: {
    disableHierarchicalLookup: true,
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
      // Tamagui packages expect to be able to require anything under the
      // tamagui umbrella node_modules folder. Some modules fail to resolve
      // without this.
      path.resolve(workspaceRoot, 'node_modules/tamagui/node_modules'),
    ],
  },
});
