import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // @rindra/desktop is linked from a separate checkout that carries its own
    // node_modules, so React, antd and i18next would otherwise be loaded twice
    // — once for the app, once for the library. Two React copies means every
    // hook throws "Cannot read properties of null (reading 'useContext')".
    // Deduping forces one shared copy, the app's.
    dedupe: ['react', 'react-dom', 'antd', 'react-i18next', 'i18next'],
  },
});
