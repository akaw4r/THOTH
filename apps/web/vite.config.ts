import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// In dev (outside Docker) proxies /api to the local API.
// In production Caddy routes /api → api and everything else → web (static build).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@thoth/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
});
