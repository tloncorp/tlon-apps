/// <reference types="vitest" />
import packageJson from './package.json';
import { loadEnv, defineConfig, BuildOptions } from 'vite';
import react from '@vitejs/plugin-react';
import analyze from 'rollup-plugin-analyzer';
import { visualizer } from 'rollup-plugin-visualizer';
import { urbitPlugin } from '@urbit/vite-plugin-urbit';
import { fileURLToPath } from 'url';
import basicSsl from '@vitejs/plugin-basic-ssl';

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
          basicSsl(),
          urbitPlugin({
            base: 'talk',
            target: SHIP_URL,
            changeOrigin: true,
            secure: false,
          }),
          react({
            jsxImportSource: '@welldone-software/why-did-you-render',
          }),
        ];
      default:
        return [
          basicSsl(),
          urbitPlugin({
            base: 'groups',
            target: SHIP_URL,
            changeOrigin: true,
            secure: false,
          }),
          react({
            jsxImportSource: '@welldone-software/why-did-you-render',
          }),
        ];
    }
  };

  console.log(process.env.APP);
  console.log(mode, app, base(mode, app));

  return defineConfig({
    base: base(mode, app),
    server: {
      https: true,
      host: 'localhost',
      port: 3000,
    },
    build:
      mode !== 'profile'
        ? {
            sourcemap: false,
          }
        : ({
            rollupOptions: {
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
