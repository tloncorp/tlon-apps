import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

/**
 * vite-node config for the surface seed (see
 * `docs/tlon-apps/surface-channels-seed.md`).
 *
 * The seed has to run the real `@tloncorp/shared` store in plain node, and
 * the store's import graph reaches React Native and Expo leaves that have
 * no node build. vite's resolution (rather than tsx's) is what makes this
 * work at all: it applies the workspace's `tlon-source` export condition
 * and handles the CJS/ESM interop that a raw node loader trips over on
 * `lodash`.
 *
 * Only device-only leaves are stubbed. The store, the api client, the db
 * layer, the reducer and the surface modules all load and run for real —
 * and every check the seed makes reads the SHIP back afterwards, so a stub
 * standing in on a path that actually mattered would show up as a failed
 * check rather than a false pass.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const stub = path.resolve(here, 'stubs/nativeModule.ts');

/**
 * Package specifiers with no node build. Several of these throw at module
 * scope reading a `globalThis` that only the native runtime installs, so
 * there is no configuration under which they both load and behave.
 */
const NATIVE_ONLY = [
  /^react-native$/,
  /^react-native-.*/,
  /^@react-native\/.*/,
  /^@react-native-.*/,
  /^expo$/,
  /^expo-.*/,
  /^@op-engineering\/op-sqlite$/,
];

function stubNativeModules() {
  return {
    name: 'surface-seed-stub-native-modules',
    enforce: 'pre' as const,
    resolveId(source: string) {
      return NATIVE_ONLY.some((pattern) => pattern.test(source)) ? stub : null;
    },
  };
}

export default defineConfig({
  plugins: [stubNativeModules()],
  resolve: { conditions: ['tlon-source'] },
  define: { __DEV__: 'false' },
});
