import { defineConfig } from 'tsup';

export default defineConfig({
  entryPoints: [
    'src/index.ts',
    'src/urbit/*',
    'src/client/index.ts',
    'src/db/index.ts',
    'src/db/migrations/index.ts',
    'src/api/index.ts',
  ],
  format: ['esm'],
  dts: true,
  external: ['react'],
  ignoreWatch: ['**/node_modules/**', '**/.git/**'],
  loader: {
    '.sql': 'text',
  },
});
