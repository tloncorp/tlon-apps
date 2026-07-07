// ref: https://github.com/Bram-dc/vite-plugin-react-native-web
import type { Plugin as ESBuildPlugin } from 'esbuild';
// @ts-expect-error - flow-remove-types is not typed
import flowRemoveTypes from 'flow-remove-types';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { transformWithEsbuild } from 'vite';
import type { Plugin as VitePlugin } from 'vite';

// import type { ViteReactNativeWebOptions } from '../types'

const development = process.env.NODE_ENV === 'development';

const extensions = [
  '.web.mjs',
  '.mjs',
  '.web.js',
  '.js',

  '.web.mts',
  '.mts',
  '.web.ts',
  '.ts',

  '.web.jsx',
  '.jsx',

  '.web.tsx',
  '.tsx',

  '.json',
];

const loader = {
  '.js': 'jsx',
} as const;

const filter = /\.(js|flow)$/;
const nativeFilter = /\.native\.(js|jsx|ts|tsx)$/;

const esbuildPlugin = (): ESBuildPlugin => ({
  name: 'react-native-web',
  setup: (build) => {
    build.onLoad({ filter }, async ({ path }) => {
      const src = await fs.readFile(path, 'utf-8');
      return {
        contents: flowRemoveTypes(src).toString(),
        loader: loader['.js'],
      };
    });
  },
});

const reactNativeWeb =
  (/*options: ViteReactNativeWebOptions = {}*/): VitePlugin => ({
    enforce: 'pre',
    name: 'react-native-web',

    config: () => ({
      define: {
        // this is necessary for sqlocal and @tamagui/animations-moti to work
        global: 'globalThis',
        __DEV__: JSON.stringify(development),
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      },
      resolve: {
        extensions,
        alias: [
          { find: 'react-native', replacement: 'react-native-web' },
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
            find: 'react-native-webview',
            replacement: '@10play/react-native-web-webview',
          },
          {
            find: 'react-native/Libraries/Utilities/codegenNativeComponent',
            replacement: '@10play/react-native-web-webview/shim',
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
        esbuildOptions: {
          plugins: [esbuildPlugin()],
          resolveExtensions: extensions,
        },
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              'react-native-web': ['react-native-web'],
              'react-native-reanimated': ['react-native-reanimated'],
              'react-native-gesture-handler': ['react-native-gesture-handler'],
              'react-native-screens': ['react-native-screens'],
              'react-native-safe-area-context': [
                'react-native-safe-area-context',
              ],
              '@react-navigation/native': ['@react-navigation/native'],
              '@react-navigation/drawer': ['@react-navigation/drawer'],
            },
          },
        },
      },
    }),

    // Ensure .web.* index files are preferred for directory imports.
    // Vite's resolve.extensions works for file imports but not for
    // directory/index resolution inside node_modules, which causes
    // issues with packages like expo-modules-core that have both
    // index.ts (noop) and index.web.ts (web polyfill) files.
    resolveId: {
      order: 'pre' as const,
      handler(source, importer) {
        if (!importer) return null;

        // Only handle relative imports
        if (!source.startsWith('.')) {
          return null;
        }

        const dir = path.dirname(importer);
        const resolved = path.resolve(dir, source);

        // Check if the resolved path is a directory with web-specific index files
        const webExtensions = ['.web.tsx', '.web.ts', '.web.jsx', '.web.js'];
        for (const ext of webExtensions) {
          const webIndex = path.join(resolved, `index${ext}`);
          if (existsSync(webIndex)) {
            return { id: webIndex, moduleSideEffects: true };
          }
        }

        return null;
      },
    },

    async transform(code, id) {
      if (!filter.test(id)) return code;

      if (nativeFilter.test(id)) {
        return null;
      }

      if (code.includes('@flow')) code = flowRemoveTypes(code).toString();

      const transformed = await transformWithEsbuild(code, id, {
        loader: loader['.js'],
        tsconfigRaw: {
          compilerOptions: {
            jsx: 'react-jsx',
          },
        },
      });

      return {
        code: transformed.code,
        map: transformed.map ?? null,
      };
    },
  });

export default reactNativeWeb;
