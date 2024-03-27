// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const { mergeConfig } = require('@react-native/metro-config');
const path = require('path');
const connect = require('connect');
const { spawn } = require('child_process');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const config = getDefaultConfig(projectRoot);

module.exports = mergeConfig(config, {
  watchFolders: [workspaceRoot],
  transformer: {
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
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
  server: {
    enhanceMiddleware: (metroMiddleware) => {
      return connect()
        .use(metroMiddleware)
        .use('/open-sqlite', (req, res) => {
          const dbPath = new URL('http://localhost' + req.url).searchParams.get(
            'path'
          );
          openDrizzleStudio(dbPath);
          res.end('ok');
        });
    },
  },
  resolver: {
    assetExts: config.resolver.assetExts.filter((ext) => ext !== 'svg'),
    disableHierarchicalLookup: true,
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
      // Tamagui packages expect to be able to require anything under the
      // tamagui umbrella node_modules folder. Some modules fail to resolve
      // without this.
      path.resolve(workspaceRoot, 'node_modules/tamagui/node_modules'),
    ],
    sourceExts: [...config.resolver.sourceExts, 'svg', 'sql'],
  },
});

function openDrizzleStudio(dbPath) {
  const ps = spawn(
    '../../node_modules/.bin/drizzle-kit',
    `studio --config ./drizzle-studio.config.ts`.split(' '),
    {
      env: { ...process.env, DB_URL: dbPath },
      cwd: projectRoot,
    }
  );
  process.on('exit', function () {
    ps.kill(9);
  });
  import('open').then(({ default: open }) =>
    open('http://local.drizzle.studio')
  );
}
