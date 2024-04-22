import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// This config is used to build the web editor into a single file

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      external: ['react-native', '@10play/tentap-editor'],
    },
  },
  resolve: {
    alias: [],
  },
  plugins: [react(), viteSingleFile()],
  server: {
    port: 3000,
  },
});
