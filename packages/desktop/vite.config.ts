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
        // Every export here is browser chrome — it reads localStorage, measures
        // columns and listens for keys. Without this directive, importing the
        // package from a Next.js Server Component fails the build with "You're
        // importing a component that needs `createContext`. This React Hook
        // only works in a Client Component." The directive lets a consumer
        // import us from anywhere; it does not stop us being prerendered, which
        // is correct — client components still SSR.
        // Must stay the very first statement in the file.
        banner: "'use client';",
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
