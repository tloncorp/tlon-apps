import { createRequire } from 'node:module';

import { defineConfig } from 'vite';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');

const external = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
  /^node:/,
];

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: 'src/index.ts',
      fileName: () => 'index.js',
      formats: ['es'],
    },
    rollupOptions: {
      external,
    },
    sourcemap: true,
    target: 'es2020',
  },
});
