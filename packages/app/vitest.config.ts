import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Resolve workspace packages to their TypeScript sources, matching
    // tsconfig's customConditions, packages/shared's vitest config, and both
    // vite configs. Without it `@tloncorp/api` resolves to its `dist`, so tests
    // silently run against a stale build and a newly added export reads as
    // missing.
    conditions: ['tlon-source'],
    // react-native ships Flow-typed source that vitest can't parse. Tests only
    // pull it in transitively (e.g. react-native-transformer-text-input imports
    // `Platform`), so resolve it to the lightweight node mock.
    alias: [
      {
        find: /^react-native$/,
        replacement: path.resolve(
          __dirname,
          './test/__mocks__/react-native.ts'
        ),
      },
    ],
  },
  test: {
    server: {
      deps: {
        // Inline so its internal `import 'react-native'` is routed through the
        // alias above instead of being externalized to RN's Flow source.
        inline: ['react-native-transformer-text-input'],
      },
    },
  },
});
