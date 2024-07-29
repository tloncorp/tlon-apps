// ref: https://github.com/Bram-dc/vite-plugin-react-native-web
import type { Plugin as ESBuildPlugin } from 'esbuild';
// @ts-expect-error - flow-remove-types is not typed
import flowRemoveTypes from 'flow-remove-types';
import fs from 'fs/promises';
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
        alias: [{ find: 'react-native', replacement: 'react-native-web' }],
      },
      optimizeDeps: {
        esbuildOptions: {
          plugins: [esbuildPlugin()],
          resolveExtensions: extensions,
        },
      },
    }),

    async transform(code, id) {
      if (!filter.test(id)) return code;

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
