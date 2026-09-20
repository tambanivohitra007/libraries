import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()] },
  preload: { plugins: [externalizeDepsPlugin()] },
  renderer: {
    plugins: [react()],
    resolve: {
      // @rindra/desktop is linked from a separate checkout carrying its own
      // node_modules, so React and antd would be loaded twice — once for the
      // app, once for the library. Two React copies break every hook with
      // "Cannot read properties of null (reading 'useContext')".
      dedupe: ['react', 'react-dom', 'antd', 'react-i18next', 'i18next'],
    },
  },
});
