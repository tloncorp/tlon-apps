/// <reference types="vitest" />
import { loadEnv, defineConfig } from 'vite';
import reactRefresh from '@vitejs/plugin-react-refresh';
import { urbitPlugin } from '@urbit/vite-plugin-urbit';

// https://vitejs.dev/config/
export default ({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd()));
  const SHIP_URL = process.env.SHIP_URL || process.env.VITE_SHIP_URL || 'http://localhost:8080';
  console.log(SHIP_URL);

  return defineConfig({
    plugins: [urbitPlugin({ base: 'homestead', target: SHIP_URL, secure: false }), reactRefresh()],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './test/setup.ts',
      deps: {
        // Inline these libs because their package.json declares them to be 
        // ES6+ modules, but are actually CommonJS modules. Vite was choking
        // on these because of the mismatch
        inline: ['@urbit/api', '@urbit/http-api'],
      }
    },
  });
};
