import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The gallery points at the library's *source*, not its dist bundle, so editing
// a component hot-reloads here instantly. The exports map and built types are
// covered by examples/smoke instead — between them both paths stay honest.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@rindra/desktop/styles.css': resolve(
        import.meta.dirname,
        '../../packages/desktop/src/styles/index.css',
      ),
      '@rindra/desktop': resolve(import.meta.dirname, '../../packages/desktop/src/index.ts'),
    },
  },
});
