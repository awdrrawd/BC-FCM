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
        // main.js imports ./app.js by name, so app.js keeps a stable file name. Split-off tab chunks are
        // content-hashed: a new app.js can then never load an older cached chunk (or the reverse).
        chunkFileNames: chunk => (chunk.name === 'app' ? 'assets/app.js' : 'assets/[name]-[hash].js'),
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});
