import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

// GitHub Pages serves 404.html for any path that isn't a real file. Copying the
// built index.html to 404.html makes client-side routes (e.g. "/app") load the
// SPA instead of a hard 404.
function spaFallback() {
  return {
    name: 'spa-404-fallback',
    closeBundle() {
      const indexFile = path.resolve(__dirname, 'dist/index.html');
      const fallbackFile = path.resolve(__dirname, 'dist/404.html');
      if (fs.existsSync(indexFile)) {
        fs.copyFileSync(indexFile, fallbackFile);
      }
    },
  };
}

export default defineConfig(() => {
  return {
    // Served from https://<user>.github.io/notewave-web/ (GitHub project Pages).
    // For a custom domain served at the root, change this to '/'.
    base: '/notewave-web/',
    plugins: [react(), tailwindcss(), spaFallback()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
