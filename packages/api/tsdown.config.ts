import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist',
  sourcemap: true,
  dts: { tsgo: true },
  clean: true,
  tsconfig: 'tsconfig.build.json',
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
});
