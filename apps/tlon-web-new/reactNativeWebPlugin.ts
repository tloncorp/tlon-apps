// ref: https://github.com/Bram-dc/vite-plugin-react-native-web
import type { Plugin as ESBuildPlugin } from 'esbuild';
// @ts-expect-error - flow-remove-types is not typed
import flowRemoveTypes from 'flow-remove-types';
import fs from 'fs/promises';
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

    async transform(code, id) {
      if (!filter.test(id)) return code;

      if (nativeFilter.test(id)) {
        return null;
      }

      if (code.includes('@flow')) code = flowRemoveTypes(code).toString();

      return (
        await transformWithEsbuild(code, id, {
          loader: loader['.js'],
          tsconfigRaw: {
            compilerOptions: {
              jsx: 'react-jsx',
            },
          },
        })
      ).code;
    },
  });

export default reactNativeWeb;
