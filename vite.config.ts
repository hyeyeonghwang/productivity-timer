/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Tauri expects a fixed dev server and leaves Rust-side logging intact.
// `TAURI_*` env vars are injected by the Tauri CLI during dev/build.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],

  // Prevent Vite from obscuring Rust errors during `tauri dev`.
  clearScreen: false,

  server: {
    host: host || 'localhost',
    port: 5173,
    strictPort: true,
    hmr: host
      ? { protocol: 'ws', host, port: 1421 }
      : undefined,
    watch: {
      // Don't watch the Rust side from Vite.
      ignored: ['**/src-tauri/**'],
    },
  },

  // Only env vars prefixed with these are exposed to the client.
  envPrefix: ['VITE_', 'TAURI_ENV_*'],

  build: {
    // Multi-page: the main timer app and the standalone celebration overlay.
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        overlay: resolve(__dirname, 'overlay.html'),
      },
    },
    // Produce sourcemaps only outside release for easier debugging.
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
  },
});
