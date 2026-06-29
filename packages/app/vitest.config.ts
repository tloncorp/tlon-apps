import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
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
