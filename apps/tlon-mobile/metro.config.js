// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const { mergeConfig } = require('@react-native/metro-config');
const path = require('path');
const fs = require('fs');
const connect = require('connect');
const { spawn } = require('child_process');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const config = getDefaultConfig(projectRoot);

module.exports = mergeConfig(
  config,
  {
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
        return (
          connect()
            .use(metroMiddleware)
            .use((req, res, next) => {
              // Handle both /open-sqlite and /apps/tlon-mobile/open-sqlite
              if (!req.url.includes('/open-sqlite')) {
                return next();
              }
              const dbPath = new URL(
                'http://localhost' + req.url
              ).searchParams.get('path');
              openDrizzleStudio(dbPath);
              res.end('ok');
            })
            /**
             * Dumps SQLite database from simulator to Metro host.
             * - databaseSourcePath: path to the SQLite database in the simulator.
             * - outputPath: path for output file, relative to workspace root
             */
            .use((req, res, next) => {
              // Handle both /dump-sqlite and /apps/tlon-mobile/dump-sqlite
              if (!req.url.includes('/dump-sqlite')) {
                return next();
              }
              const params = new URL('http://localhost' + req.url).searchParams;
              const dbPath = params.get('databaseSourcePath');
              const outputPath = params.get('outputPath');
              const dest = path.resolve(workspaceRoot, outputPath);
              try {
                fs.copyFileSync(dbPath, dest);
                console.log('/dump-sqlite', 'Copied', dbPath, 'to', dest);
                res.end('ok');
              } catch (err) {
                console.error('/dump-sqlite', err);
                res.statusCode = 500;
                res.end(err.message);
              }
            })
            /**
             * Replaces SQLite on simulator with a database from Metro host.
             * - sourcePath: path of database file on Metro host
             * - targetPath: path of database on simulator that will be overwritten
             *   with contents of file at `sourcePath`
             */
            .use((req, res, next) => {
              // Handle both /restore-sqlite and /apps/tlon-mobile/restore-sqlite
              if (!req.url.includes('/restore-sqlite')) {
                return next();
              }
              const params = new URL('http://localhost' + req.url).searchParams;
              const sourcePath = params.get('sourcePath');
              const targetPath = params.get('targetPath');

              try {
                fs.copyFileSync(sourcePath, targetPath);
                console.log(
                  '/restore-sqlite',
                  'Copied',
                  sourcePath,
                  'to',
                  targetPath
                );
                res.end('ok');
              } catch (err) {
                console.error('/restore-sqlite', err);
                res.statusCode = 500;
                res.end(err.message);
              }
            })
        );
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

      // Enables importing alternative package exports, e.g. `react-tweet/api`
      unstable_enablePackageExports: true,
      // Removes import, which causes issues for zustand
      // This is the default setting in newer versions of react-native
      unstable_conditionNames: ['require'],
    },
  }
  // mockModulesConfig()
);

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

/// mimics the non-tagged template literal behavior
function defaultTemplateLiteral(strings, ...interpolations) {
  return strings.reduce((result, string, i) => {
    const interpolation = i < interpolations.length ? interpolations[i] : '';
    return result + string + interpolation;
  }, '');
}

// TODO: Only apply mocks where we want them.
// This is tough because we often invisibly use the default app fixture - we don't want to (effectively) mock there.
function mockModulesConfig() {
  // `r`esolve a workspace path
  const r = (strings, ...interpolations) => {
    const relativePath = defaultTemplateLiteral(strings, ...interpolations);
    return path.resolve(workspaceRoot, relativePath);
  };

  const MODULE_MOCKS = {
    [r`packages/shared/src/api/urbit.ts`]: r`packages/app/fixtures/__mocks__/urbit.ts`,
  };

  return {
    resolver: {
      resolveRequest: (context, moduleName, platform) => {
        const defaultResolution = context.resolveRequest(
          context,
          moduleName,
          platform
        );
        if (defaultResolution.type === 'sourceFile') {
          if (MODULE_MOCKS[defaultResolution.filePath]) {
            return {
              type: 'sourceFile',
              filePath: MODULE_MOCKS[defaultResolution.filePath],
            };
          }
        }
        return defaultResolution;
      },
    },
  };
}
