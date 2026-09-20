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
      entry: {
        index: resolve(import.meta.dirname, 'src/index.ts'),
        // A separate chunk, so an app that never prints does not carry a DOCX
        // writer and 31 kB of print CSS.
        print: resolve(import.meta.dirname, 'src/print/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react-i18next',
        'antd',
        '@ant-design/icons',
        'qrcode-generator',
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
        entryFileNames: '[name].js',
        // The only CSS in the JS graph is the preview's own sheet; the main
        // stylesheet is assembled separately by scripts/build-css.mjs.
        assetFileNames: () => 'print.css',
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
