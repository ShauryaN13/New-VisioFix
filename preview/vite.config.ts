import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

/**
 * Design preview (dev only, never part of the extension).
 * `npm run design` serves it at http://localhost:5180 with sample data.
 * It renders the real view code from src/, so what you see is what ships.
 */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  // Fonts and icons live in the extension's public/ folder.
  publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  resolve: {
    alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) },
  },
  server: {
    port: 5180,
    fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
  },
});
