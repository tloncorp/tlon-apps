import { exec } from 'child_process';
import { defineConfig } from 'tsup';

export default defineConfig({
  entryPoints: [
    'src/index.ts',
    'src/urbit/*',
    'src/client/index.ts',
    'src/db/index.ts',
    'src/db/migrations/index.ts',
    'src/api/index.ts',
    'src/logic/index.ts',
    'src/store/index.ts',
  ],
  format: ['esm'],
  minify: false,
  external: ['react'],
  ignoreWatch: ['**/node_modules/**', '**/.git/**'],
  loader: {
    '.sql': 'text',
  },
  onSuccess() {
    return new Promise((resolve, reject) => {
      exec('npm run types', (err) => {
        err ? reject(err) : resolve();
      });
    });
  },
});
