import { defineConfig } from 'vite';

// The sandbox artifact build: one self-contained IIFE JS file and one CSS
// file, nothing dynamic, no hashes in names, no sourcemaps — byte-stable
// across builds of the same tree (scripts/check-deterministic-build.mjs
// verifies).
export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'preact',
    legalComments: 'none',
  },
  build: {
    target: 'es2020',
    // readable output: the artifact is reviewed and injected locally, so
    // auditability beats size
    minify: false,
    sourcemap: false,
    cssCodeSplit: false,
    emptyOutDir: true,
    lib: {
      entry: 'src/artifact/main.ts',
      name: 'TlonSurfaceShell',
      formats: ['iife'],
      fileName: () => 'surface-shell.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: 'surface-shell.[ext]',
      },
    },
  },
});
