/// <reference types="vitest" />
import packageJson from './package.json';
import { loadEnv, defineConfig } from 'vite';
import reactRefresh from '@vitejs/plugin-react-refresh';
import analyze from 'rollup-plugin-analyzer';
import { visualizer } from 'rollup-plugin-visualizer';
import { urbitPlugin } from '@urbit/vite-plugin-urbit';
import pluginRewriteAll from 'vite-plugin-rewrite-all';

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

  const base = (mode: string) => {
    switch (mode) {
      case 'mock':
      case 'staging':
      case 'chatmock':
      case 'chatstaging':
        return '';
      case 'chat':
        return '/apps/chatstead/';
      default:
        return '/apps/homestead/';
    }
  };

  const plugins = (mode: string) => {
    switch (mode) {
      case 'mock':
      case 'staging':
      case 'chatmock':
      case 'chatstaging':
        return [reactRefresh(), pluginRewriteAll()];
      case 'chat':
        return [
          urbitPlugin({ base: 'chatstead', target: SHIP_URL, secure: false }),
          reactRefresh(),
        ];
      default:
        return [
          urbitPlugin({ base: 'homestead', target: SHIP_URL, secure: false }),
          reactRefresh(),
        ];
    }
  };

  return defineConfig({
    base: base(mode),
    build:
      mode !== 'profile'
        ? {}
        : {
            rollupOptions: {
              plugins: [
                analyze({
                  limit: 20,
                }),
                visualizer(),
              ],
            },
          },
    plugins: plugins(mode),
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './test/setup.ts',
      deps: {},
    },
  });
};
