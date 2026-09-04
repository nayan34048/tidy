import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves project sites from /<repo-name>/, so the base path
// must match the repository name. Update REPO_NAME below (or set the
// TIDY_BASE env var at build time) to match your repository.
const REPO_NAME = process.env.TIDY_BASE || 'tidy';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? `/tidy/` : '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
}));
