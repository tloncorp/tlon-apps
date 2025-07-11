// vite.config.ts or vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    deps: {
      optimizer: {
        ssr: {
          include: ['@react-navigation/native'],
        },
      },
    },
  },
  resolve: {
    alias: {
      // We don't yet need RN in tests in this package, and
      // the use of Flow in .js files is causing issues
      // with vitest.
      'react-native': require.resolve('./test/__mocks__/react-native.ts'),
    },
  },
});
