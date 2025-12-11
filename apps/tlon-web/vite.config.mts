/// <reference types="vitest" />
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { tamaguiPlugin } from '@tamagui/vite-plugin';
import { urbitPlugin } from '@urbit/vite-plugin-urbit';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import analyze from 'rollup-plugin-analyzer';
import { visualizer } from 'rollup-plugin-visualizer';
import { fileURLToPath } from 'url';
import {
  BuildOptions,
  Plugin,
  PluginOption,
  defineConfig,
  loadEnv,
} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import svgr from 'vite-plugin-svgr';

import expo52PatchPlugin from './expo52PatchPlugin';
import packageJson from './package.json';
import reactNativeWeb from './reactNativeWebPlugin';
import manifest from './src/manifest';

// https://vitejs.dev/config/
export default ({ mode }: { mode: string }) => {
  process.env.VITE_STORAGE_VERSION =
    mode === 'dev' ? Date.now().toString() : packageJson.version;

  Object.assign(process.env, loadEnv(mode, process.cwd()));
  const SHIP_URL =
    process.env.SHIP_URL ||
    process.env.VITE_SHIP_URL ||
    'http://localhost:8080';
  console.log(SHIP_URL);
  const SHIP_URL2 =
    process.env.SHIP_URL2 ||
    process.env.VITE_SHIP_URL2 ||
    'http://localhost:8080';
  console.log(SHIP_URL2);

  // eslint-disable-next-line
  const base = (mode: string) => {
    console.log('mode', mode);

    if (mode === 'mock' || mode === 'staging') {
      return '';
    }

    if (mode === 'electron') {
      return './';
    }

    return '/apps/groups/';
  };

  // eslint-disable-next-line
  const plugins = (mode: string): PluginOption[] => {
    if (mode === 'mock' || mode === 'staging') {
      return [
        basicSsl() as Plugin,
        react({
          jsxImportSource: '@welldone-software/why-did-you-render',
        }) as PluginOption[],
      ];
    }

    if (mode === 'electron') {
      return [
        exportingRawText(/\.sql$/),
        expo52PatchPlugin(), // Fix Expo 52 static name assignments
        react({
          babel: {
            plugins: [
              '@babel/plugin-proposal-export-namespace-from',
              'react-native-reanimated/plugin',
            ],
          },
          jsxImportSource: '@welldone-software/why-did-you-render',
        }) as PluginOption[],
        svgr({
          include: '**/*.svg',
        }) as Plugin,
        reactNativeWeb(),
        tamaguiPlugin({
          config: './tamagui.config.ts',
          platform: 'web',
        }) as Plugin,
      ];
    }

    return [
      process.env.SSL === 'true' ? (basicSsl() as PluginOption) : null,
      exportingRawText(/\.sql$/),
      expo52PatchPlugin(), // Fix Expo 52 static name assignments
      urbitPlugin({
        base: 'groups',
        target: mode === 'dev2' ? SHIP_URL2 : SHIP_URL,
        changeOrigin: true,
        secure: false,
      }) as PluginOption[],
      react({
        babel: {
          // adding these per instructions here:
          // https://docs.swmansion.com/react-native-reanimated/docs/guides/web-support/
          plugins: [
            '@babel/plugin-proposal-export-namespace-from',
            'react-native-reanimated/plugin',
          ],
        },
        jsxImportSource: '@welldone-software/why-did-you-render',
      }) as PluginOption[],
      svgr({
        include: '**/*.svg',
      }) as Plugin,
      reactNativeWeb(),
      tamaguiPlugin({
        config: './tamagui.config.ts',
        platform: 'web',
      }) as Plugin,
      VitePWA({
        base: '/apps/groups/',
        manifest,
        injectRegister: 'inline',
        registerType: 'prompt',
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw-1.ts',
        useCredentials: true,
        devOptions: {
          enabled: mode === 'sw',
          type: 'module',
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          maximumFileSizeToCacheInBytes: 100000000,
          plugins: [reactNativeWeb()],
        },
      }),
      // Sentry source map upload - only enabled in CI
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_WEB_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        disable: !process.env.CI,
        sourcemaps: {
          filesToDeleteAfterUpload: ['**/*.map'],
        },
      }),
    ];
  };

  const rollupOptions = {
    external:
      mode === 'mock' || mode === 'staging' || mode === 'electron'
        ? ['react-native-device-info']
        : ['@urbit/sigil-js/dist/core', 'react-native-device-info'],
    output: {
      hashCharacters: 'base36' as any,
      manualChunks: {
        lodash: ['lodash'],
        'lodash/fp': ['lodash/fp'],
        'urbit/api': ['@urbit/api'],
        'urbit/http-api': ['@urbit/http-api'],
        'urbit/sigil-js': ['@urbit/sigil-js'],
        'any-ascii': ['any-ascii'],
        'tiptap/core': ['@tiptap/core'],
        'tiptap/extension-placeholder': ['@tiptap/extension-placeholder'],
        'tiptap/extension-link': ['@tiptap/extension-link'],
        'aws-sdk/client-s3': ['@aws-sdk/client-s3'],
        'aws-sdk/s3-request-presigner': ['@aws-sdk/s3-request-presigner'],
        'urbit-ob': ['urbit-ob'],
      },
    },
  };

  const port =
    process.env.E2E_PORT_3001 === 'true'
      ? 3001
      : process.env.VITE_PORT
        ? parseInt(process.env.VITE_PORT)
        : 3000;

  return defineConfig({
    base: base(mode),
    server: {
      host: 'localhost',
      port,
      //NOTE  the proxy used by vite is written poorly, and ends up removing
      //      empty path segments from urls: http-party/node-http-proxy#1420.
      //      as a workaround for this, we rewrite the path going into the
      //      proxy to "hide" the empty path segments, and then rewrite the
      //      path coming "out" of the proxy to obtain the original path.
      proxy: {
        '/apps/groups/~/metagrab/': {
          target: SHIP_URL,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              // Log the path for debugging
              console.log('Proxying request to:', proxyReq.path);
            });
            proxy.on('proxyRes', (proxyRes, req) => {
              console.log(
                'Proxy response for:',
                req.url,
                'Status:',
                proxyRes.statusCode
              );
            });
            proxy.on('error', (err, req) => {
              console.error('Proxy error:', err, 'for request:', req.url);
            });
          },
        },
        '^.*//.*': {
          target: SHIP_URL,
          rewrite: (path) => path.replaceAll('//', '/@@@/'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.path = proxyReq.path.replaceAll('/@@@/', '//');
            });
          },
        },
      },
    },
    build:
      mode !== 'profile'
        ? {
            // Only generate sourcemaps in CI for Sentry upload (avoids noisy warnings locally)
            sourcemap: process.env.CI ? 'hidden' : false,
            rollupOptions,
            target: 'esnext',
          }
        : ({
            rollupOptions: {
              ...rollupOptions,
              plugins: [
                analyze({
                  limit: 20,
                }),
                visualizer(),
              ],
            },
          } as BuildOptions),
    worker: {
      format: 'es',
      rollupOptions: {
        output: {
          hashCharacters: 'base36' as any,
        },
      },
    },
    plugins: plugins(mode),
    resolve: {
      dedupe: ['@tanstack/react-query'],
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        ...(mode === 'electron'
          ? {
              'virtual:pwa-register/react': fileURLToPath(
                new URL('./src/logic/useAppUpdatesStub.ts', import.meta.url)
              ),
              '@react-native-firebase/crashlytics': fileURLToPath(
                new URL('./src/crashlytics-stub.ts', import.meta.url)
              ),
              'expo-notifications': fileURLToPath(
                new URL('./src/notifications-stub.ts', import.meta.url)
              ),
            }
          : {}),
      },
    },
    optimizeDeps: {
      exclude: [
        'sqlocal',
        ...(mode === 'electron' ? ['virtual:pwa-register/react'] : []),
      ],
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './test/setup.ts',
      deps: {},
      include: ['**/*.test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      server: {
        deps: {
          inline: ['react-tweet'],
        },
      },
    },
  });
};

/** Transforms matching files into ES modules that export the file's content as a string */
function exportingRawText(matchId: RegExp): Plugin {
  return {
    name: 'inline sql',
    enforce: 'pre',
    transform(_code, id) {
      if (matchId.test(id)) {
        const sql = fs.readFileSync(id, 'utf-8');
        return `export default ${JSON.stringify(sql)}`;
      }
    },
  };
}
