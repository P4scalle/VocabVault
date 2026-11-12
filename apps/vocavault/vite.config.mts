/// <reference types="vitest" />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig(({ mode }) => ({
  root: __dirname,
  plugins: [angular(), nxViteTsPaths()],
  test: {
    name: 'vocavault',
    watch: false,
    globals: true,
    passWithNoTests: false,
    environment: 'happy-dom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reportsDirectory: '../../coverage/apps/vocavault',
    },
  },
  define: {
    'import.meta.vitest': mode !== 'production',
  },
}));
