/// <reference types="vitest" />
import { tamaguiPlugin } from '@tamagui/vite-plugin';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Plugin, PluginOption, defineConfig, loadEnv } from 'vite';
import svgr from 'vite-plugin-svgr';

import expo52PatchPlugin from './expo52PatchPlugin';
import packageJson from './package.json';
import reactNativeWeb from './reactNativeWebPlugin';

// Dedicated Vite config for React Cosmos.
//
// react-cosmos-plugin-vite 7.2.0 misbehaves when the host config sets `base`:
// the renderer swap can miss, causing the real app to boot inside the renderer.
// Keep Cosmos on a minimal config without `base`, Urbit proxy, PWA, or Sentry.
export default defineConfig(({ mode }) => {
  process.env.VITE_STORAGE_VERSION = packageJson.version;
  Object.assign(process.env, loadEnv(mode, process.cwd()));

  return {
    envPrefix: ['VITE_', 'TAMAGUI_'],
    plugins: [
      cosmosIndexHtmlPlugin(),
      exportingRawText(/\.sql$/),
      expo52PatchPlugin(),
      react({
        babel: {
          plugins: [
            '@babel/plugin-proposal-export-namespace-from',
            'react-native-worklets/plugin',
          ],
        },
        jsxImportSource: '@welldone-software/why-did-you-render',
      }) as PluginOption[],
      svgr({ include: '**/*.svg' }) as Plugin,
      reactNativeWeb(),
      tamaguiPlugin({
        config: './tamagui.config.ts',
        platform: 'web',
      }) as Plugin,
    ],
    resolve: {
      conditions: ['tlon-source'],
      dedupe: ['@tanstack/react-query'],
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        'virtual:pwa-register/react': fileURLToPath(
          new URL('./src/logic/useAppUpdatesStub.ts', import.meta.url)
        ),
        'react-native-reanimated': fileURLToPath(
          new URL('../../node_modules/react-native-reanimated', import.meta.url)
        ),
      },
    },
    optimizeDeps: {
      exclude: ['sqlocal', 'virtual:pwa-register/react'],
    },
  };
});

function cosmosIndexHtmlPlugin(): Plugin {
  return {
    name: 'cosmos index html',
    enforce: 'pre',
    transformIndexHtml(html) {
      return html.replace(
        /\s*<script type="module" src="\/src\/storage-wipe\.ts"><\/script>/,
        ''
      );
    },
  };
}

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
