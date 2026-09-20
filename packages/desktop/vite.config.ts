import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Library build: one ESM entry plus one stylesheet. Everything the host app
// already has — React, antd, the icon set, i18next — stays external so the app
// and the library share a single copy at runtime.
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react-i18next',
        'antd',
        '@ant-design/icons',
        /^antd\//,
        /^@ant-design\//,
      ],
      output: {
        assetFileNames: (info) =>
          info.names?.includes('index.css') ? 'styles.css' : '[name][extname]',
      },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
