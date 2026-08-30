import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

// Build a side-effect-free bootstrap (assets/main.js) plus the application
// chunk (assets/app.js), preserving the duplicate-load guard as a real boundary.
export default defineConfig({
  base: './',
  define: {
    __FCM_VERSION__: JSON.stringify(pkg.version),
  },
  server: { cors: true },
  preview: { cors: true },
  build: {
    target: 'es2020',
    rollupOptions: {
      input: 'src/main.js',
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});
