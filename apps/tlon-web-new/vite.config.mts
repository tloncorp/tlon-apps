/// <reference types="vitest" />
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

import packageJson from './package.json';
import reactNativeWeb from './reactNativeWebPlugin';
import manifest from './src/manifest';
import manifestAlpha from './src/manifest-alpha';

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
    if (mode === 'mock' || mode === 'staging') {
      return '';
    }

    if (mode === 'alpha') {
      return '/apps/tm-alpha/';
    }
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

    return [
      process.env.SSL === 'true' ? (basicSsl() as PluginOption) : null,
      exportingRawText(/\.sql$/),
      urbitPlugin({
        base: mode === 'alpha' ? 'tm-alpha' : 'groups',
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
        base: mode === 'alpha' ? '/apps/tm-alpha/' : '/apps/groups/',
        manifest: mode === 'alpha' ? manifestAlpha : manifest,
        injectRegister: 'inline',
        registerType: 'prompt',
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
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
    ];
  };

  const rollupOptions = {
    external:
      mode === 'mock' || mode === 'staging'
        ? ['virtual:pwa-register/react']
        : [
            '@urbit/sigil-js/dist/core',
            'react-native-device-info',
          ],
    output: {
      hashCharacters: 'base36' as any,
      manualChunks: {
        lodash: ['lodash'],
        'lodash/fp': ['lodash/fp'],
        'urbit/api': ['@urbit/api'],
        'urbit/http-api': ['@urbit/http-api'],
        'urbit/sigil-js': ['@urbit/sigil-js'],
        'any-ascii': ['any-ascii'],
        'react-beautiful-dnd': ['react-beautiful-dnd'],
        'emoji-mart': ['emoji-mart'],
        'tiptap/core': ['@tiptap/core'],
        'tiptap/extension-placeholder': ['@tiptap/extension-placeholder'],
        'tiptap/extension-link': ['@tiptap/extension-link'],
        'react-virtuoso': ['react-virtuoso'],
        'react-select': ['react-select'],
        'react-hook-form': ['react-hook-form'],
        'framer-motion': ['framer-motion'],
        'date-fns': ['date-fns'],
        'tippy.js': ['tippy.js'],
        'aws-sdk/client-s3': ['@aws-sdk/client-s3'],
        'aws-sdk/s3-request-presigner': ['@aws-sdk/s3-request-presigner'],
        refractor: ['refractor'],
        'urbit-ob': ['urbit-ob'],
        'hast-to-hyperscript': ['hast-to-hyperscript'],
        'radix-ui/react-dialog': ['@radix-ui/react-dialog'],
        'radix-ui/react-dropdown-menu': ['@radix-ui/react-dropdown-menu'],
        'radix-ui/react-popover': ['@radix-ui/react-popover'],
        'radix-ui/react-toast': ['@radix-ui/react-toast'],
        'radix-ui/react-tooltip': ['@radix-ui/react-tooltip'],
        'react-native-reanimated': ['react-native-reanimated'],
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
            sourcemap: false,
            rollupOptions,
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
      rollupOptions: {
        output: {
          hashCharacters: 'base36' as any,
        },
      },
    },
    plugins: plugins(mode),
    resolve: {
      dedupe: ['@tanstack/react-query'],
      alias: [
        {
          find: '@',
          replacement: fileURLToPath(new URL('./src', import.meta.url)),
        },
        {
          find: '@react-native-firebase/crashlytics',
          replacement: fileURLToPath(
            new URL(
              './src/mocks/react-native-firebase-crashlytics.js',
              import.meta.url
            )
          ),
        },
        {
          find: '@tloncorp/editor/dist/editorHtml',
          replacement: fileURLToPath(
            new URL('./src/mocks/tloncorp-editor-html.js', import.meta.url)
          ),
        },
        {
          find: '@tloncorp/editor/src/bridges',
          replacement: fileURLToPath(
            new URL('./src/mocks/tloncorp-editor-bridges.js', import.meta.url)
          ),
        },
        {
          find: '@10play/tentap-editor',
          replacement: fileURLToPath(
            new URL('./src/mocks/tentap-editor.js', import.meta.url)
          ),
        },
        {
          find: 'react-native-gesture-handler/ReanimatedSwipeable',
          replacement: fileURLToPath(
            new URL(
              './src/mocks/react-native-gesture-handler.js',
              import.meta.url
            )
          ),
        },
      ],
    },
    optimizeDeps: {
      exclude: ['sqlocal'],
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
