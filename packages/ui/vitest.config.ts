import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@tloncorp/shared': path.resolve(__dirname, 'src/test/sharedStub.ts'),
    },
  },
});
