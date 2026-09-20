// Flattens src/styles/index.css into a single dist/styles.css by inlining its
// @import list. Concatenating here rather than shipping the @imports means the
// consumer's bundler has nothing to resolve, and a plain <link> to the file
// costs one request instead of nine.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, '../src/styles/index.css');
const out = resolve(here, '../dist/styles.css');

const IMPORT_RE = /^\s*@import\s+['"](.+?)['"]\s*;\s*$/gm;

/** Inline every @import, depth-first, so the output keeps source order. */
function flatten(file, seen = new Set()) {
  const path = resolve(file);
  if (seen.has(path)) return ''; // a sheet imported twice is emitted once
  seen.add(path);
  return readFileSync(path, 'utf8').replace(IMPORT_RE, (_, spec) => {
    const child = resolve(dirname(path), spec);
    return `/* ${spec} */\n${flatten(child, seen)}`;
  });
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, flatten(entry), 'utf8');

// TypeScript rejects a side-effect import of a non-module file unless something
// declares it. Shipping the declaration here spares every consuming app from
// needing `vite/client` types or its own `*.css` shim just to import our sheet.
// print.css is emitted by the Vite build, but needs the same courtesy.
writeFileSync(`${out}.d.ts`, 'export {};\n', 'utf8');
writeFileSync(resolve(here, '../dist/print.css.d.ts'), 'export {};\n', 'utf8');

console.log(`styles.css  ${(readFileSync(out, 'utf8').length / 1024).toFixed(1)} kB`);
