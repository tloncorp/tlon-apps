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
    // requireCycleIgnorePatterns needs to cover ContentReference, as
    // that require cycle can't be avoided without a major refactor.
    requireCycleIgnorePatterns: [
      /packages\/ui\/src\/components\/ContentReference\//,
      // according to the docs we need to specifically add this pattern to the
      // list if we add any of our own patterns
      // https://metrobundler.dev/docs/configuration/#requirecycleignorepatterns
      /(^|\/|\\)node_modules($|\/|\\)/,
    ],
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
      // Tamagui packages expect to be able to require anything under the
      // tamagui umbrella node_modules folder. Some modules fail to resolve
      // without this.
      path.resolve(workspaceRoot, 'node_modules/tamagui/node_modules'),
    ],
    sourceExts: [...config.resolver.sourceExts, 'svg', 'sql'],
    unstable_enablePackageExports: true,
  },
});

function openDrizzleStudio(dbPath) {
  console.log('Opening Drizzle Studio at', dbPath);
  const ps = spawn(
    '../../node_modules/.bin/drizzle-kit',
    `studio --config ./drizzle-studio.config.ts`.split(' '),
    {
      env: { ...process.env, DB_URL: dbPath },
      cwd: projectRoot,
    }
  );
  ps.stderr.on('data', (data) => {
    console.error(data.toString());
  });
  ps.stdout.on('data', (data) => {
    console.log(data.toString());
  });
  process.on('exit', function () {
    ps.kill(9);
  });
  import('open').then(({ default: open }) =>
    open('http://local.drizzle.studio')
  );
}
