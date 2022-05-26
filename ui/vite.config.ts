/// <reference types="vitest" />
import packageJson from './package.json';
import { loadEnv, defineConfig } from 'vite';
import reactRefresh from '@vitejs/plugin-react-refresh';
import { urbitPlugin } from '@urbit/vite-plugin-urbit';

// https://vitejs.dev/config/
export default ({ mode }) => {
  process.env.VITE_STORAGE_VERSION =
    mode === 'dev' ? Date.now().toString() : packageJson.version;

  Object.assign(process.env, loadEnv(mode, process.cwd()));
  const SHIP_URL =
    process.env.SHIP_URL ||
    process.env.VITE_SHIP_URL ||
    'http://localhost:8080';
  console.log(SHIP_URL);

  return defineConfig({
    base:
      mode === 'mock' || mode === 'staging' ? undefined : '/apps/homestead/',
    build: {
      sourcemap: 'inline',
    },
    plugins:
      mode === 'mock' || mode === 'staging'
        ? [reactRefresh()]
        : [
            urbitPlugin({ base: 'homestead', target: SHIP_URL, secure: false }),
            reactRefresh(),
          ],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './test/setup.ts',
      deps: {},
    },
  });
};
