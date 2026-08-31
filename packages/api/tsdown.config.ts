import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  // Matches the target the tsup build published; tsdown would otherwise
  // default to ESNext and quietly raise the SDK's runtime requirement.
  target: 'es2020',
  outDir: 'dist',
  sourcemap: true,
  dts: { tsgo: true },
  clean: true,
  tsconfig: 'tsconfig.build.json',
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
});
