/// <reference types="vitest" />
import packageJson from './package.json';
import { loadEnv, defineConfig, BuildOptions } from 'vite';
import react from '@vitejs/plugin-react';
import analyze from 'rollup-plugin-analyzer';
import { visualizer } from 'rollup-plugin-visualizer';
import { urbitPlugin } from '@urbit/vite-plugin-urbit';
import { fileURLToPath } from 'url';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';
import manifest from './src/assets/manifest';
import chatmanifest from './src/assets/chatmanifest';

// https://vitejs.dev/config/
export default ({ mode }: { mode: string }) => {
  const app = process.env.APP || 'groups';
  process.env.VITE_APP = app;
  process.env.VITE_STORAGE_VERSION =
    mode === 'dev' ? Date.now().toString() : packageJson.version;

  Object.assign(process.env, loadEnv(mode, process.cwd()));
  const SHIP_URL =
    process.env.SHIP_URL ||
    process.env.VITE_SHIP_URL ||
    'http://localhost:8080';
  console.log(SHIP_URL);

  const base = (mode: string, app: string) => {
    if (mode === 'mock' || mode === 'staging') {
      return '';
    }

    switch (app) {
      case 'chat':
        return '/apps/talk/';
      default:
        return '/apps/groups/';
    }
  };

  const plugins = (mode: string, app: string) => {
    if (mode === 'mock' || mode === 'staging') {
      return [
        basicSsl(),
        react({
          jsxImportSource: '@welldone-software/why-did-you-render',
        }),
      ];
    }

    switch (app) {
      case 'chat':
        return [
          mode !== 'sw' ? basicSsl() : null,
          urbitPlugin({
            base: 'talk',
            target: SHIP_URL,
            changeOrigin: true,
            secure: false,
          }),
          react({
            jsxImportSource: '@welldone-software/why-did-you-render',
          }),
          VitePWA({
            base: '/apps/talk/',
            manifest: chatmanifest,
            injectRegister: 'inline',
            registerType: 'prompt',
            devOptions: {
              enabled: mode === 'sw',
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
              maximumFileSizeToCacheInBytes: 100000000,
            },
          }),
        ];
      default:
        return [
          mode !== 'sw' ? basicSsl() : null,
          urbitPlugin({
            base: 'groups',
            target: SHIP_URL,
            changeOrigin: true,
            secure: false,
          }),
          react({
            jsxImportSource: '@welldone-software/why-did-you-render',
          }),
          VitePWA({
            base: '/apps/groups/',
            manifest: manifest,
            injectRegister: 'inline',
            registerType: 'prompt',
            devOptions: {
              enabled: mode === 'sw',
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
              maximumFileSizeToCacheInBytes: 100000000,
            },
          }),
        ];
    }
  };

  console.log(process.env.APP);
  console.log(mode, app, base(mode, app));

  const rollupOptions = {
    external:
      mode === 'mock' || mode === 'staging'
        ? ['virtual:pwa-register/react']
        : [],
    output: {
      manualChunks: {
        lodash: ['lodash'],
        'lodash/fp': ['lodash/fp'],
        '@urbit/api': ['@urbit/api'],
        '@urbit/http-api': ['@urbit/http-api'],
        '@tlon/sigil-js': ['@tlon/sigil-js'],
        'any-ascii': ['any-ascii'],
        'react-beautiful-dnd': ['react-beautiful-dnd'],
        'emoji-mart': ['emoji-mart'],
        'prosemirror-view': ['prosemirror-view'],
        '@tiptap/core': ['@tiptap/core'],
        '@tiptap/extension-placeholder': ['@tiptap/extension-placeholder'],
        '@tiptap/extension-link': ['@tiptap/extension-link'],
        'react-virtuoso': ['react-virtuoso'],
        'react-select': ['react-select'],
        'react-hook-form': ['react-hook-form'],
        'framer-motion': ['framer-motion'],
        'date-fns': ['date-fns'],
        'tippy.js': ['tippy.js'],
        '@aws-sdk/client-s3': ['@aws-sdk/client-s3'],
        '@aws-sdk/s3-request-presigner': ['@aws-sdk/s3-request-presigner'],
        refractor: ['refractor'],
        'urbit-ob': ['urbit-ob'],
        'hast-to-hyperscript': ['hast-to-hyperscript'],
        '@radix-ui/react-dialog': ['@radix-ui/react-dialog'],
        '@radix-ui/react-dropdown-menu': ['@radix-ui/react-dropdown-menu'],
        '@radix-ui/react-popover': ['@radix-ui/react-popover'],
        '@radix-ui/react-toast': ['@radix-ui/react-toast'],
        '@radix-ui/react-tooltip': ['@radix-ui/react-tooltip'],
      },
    },
  };

  return defineConfig({
    base: base(mode, app),
    server: {
      https: mode !== 'sw',
      host: 'localhost',
      port: 3000,
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
    plugins: plugins(mode, app),
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './test/setup.ts',
      deps: {},
    },
  });
};
