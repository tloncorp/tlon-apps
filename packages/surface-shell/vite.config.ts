import { defineConfig } from 'vite';

// The sandbox artifact build: one self-contained IIFE JS file and one CSS
// file, nothing dynamic, no hashes in names, no sourcemaps — byte-stable
// across builds of the same tree (scripts/check-deterministic-build.mjs
// verifies).
export default defineConfig({
  // Vite's lib mode deliberately leaves `process.env.NODE_ENV` for the
  // consumer to define — but this artifact's consumer is a sandbox with
  // `default-src 'none'` and no `process` at all, so an unreplaced read is
  // a ReferenceError waiting on a code path (sigil-js's `invariant` calls,
  // reached whenever an app hands the avatar a name that is not a point).
  // Pinning it here removes the reference and folds the dead branches out.
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
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
