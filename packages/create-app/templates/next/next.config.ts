import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import type { NextConfig } from 'next';

const require = createRequire(import.meta.url);

/** The package's *directory*, not its entry file — aliasing to the file would
 *  make subpaths like `react-i18next/initReactI18next` unresolvable. */
const pkgDir = (name: string): string => dirname(require.resolve(`${name}/package.json`));

const config: NextConfig = {
  // @rindra/desktop is linked from a separate checkout, so Next has to compile
  // it rather than treat it as a prebuilt node_modules package.
  transpilePackages: ['@rindra/desktop'],
  webpack: (cfg) => {
    // The linked checkout carries its own node_modules, so i18next would be
    // loaded twice: this app initialises one instance while the grid reads the
    // other, which was never initialised — and its toolbar renders raw keys
    // like "table.groupHint". Pinning both to this app's copy fixes it.
    //
    // Deliberately NOT react/react-dom. Aliasing those looks like the same
    // fix, but Next resolves React differently for the server graph (the
    // `react-server` export condition) and a blunt alias collapses that
    // distinction — prerendering then dies with "Cannot read properties of
    // null (reading 'useState')". transpilePackages handles React on its own.
    cfg.resolve.alias = {
      ...cfg.resolve.alias,
      i18next: pkgDir('i18next'),
      'react-i18next': pkgDir('react-i18next'),
    };
    return cfg;
  },
};

export default config;
