import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The site is served from GitHub Pages at /blackJackLearning/.
// A relative base keeps every asset path valid under that sub-path
// (and regardless of URL casing), and the app uses hash routing so
// direct loads and refreshes never hit a 404.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
  test: { globals: true, environment: 'node', include: ['tests/**/*.test.ts'] },
});
