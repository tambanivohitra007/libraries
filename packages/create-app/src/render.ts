import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

export type Tokens = Record<string, string>;

const TOKEN_RE = /__([A-Z0-9_]+)__/g;

/** Substitutes `__TOKEN__` placeholders. An unknown token is left alone rather
 *  than blanked, so a typo shows up in the output instead of vanishing. */
export function substitute(text: string, tokens: Tokens): string {
  return text.replace(TOKEN_RE, (whole, key: string) => tokens[key] ?? whole);
}

/** Template files whose names would otherwise be interpreted by tooling — npm
 *  refuses to publish a `.gitignore`, and a stray `package.json` inside the
 *  templates tree would be picked up as a real workspace package. */
const RENAME: Record<string, string> = {
  'gitignore.tmpl': '.gitignore',
  'prettierrc.tmpl': '.prettierrc',
  'npmrc.tmpl': '.npmrc',
  'package.json.tmpl': 'package.json',
};

const BINARY = new Set(['.png', '.jpg', '.jpeg', '.ico', '.gif', '.woff', '.woff2', '.icns']);

function isBinary(file: string): boolean {
  const dot = file.lastIndexOf('.');
  return dot >= 0 && BINARY.has(file.slice(dot).toLowerCase());
}

export interface CopyResult {
  written: string[];
}

/**
 * Copies a template directory into `destDir`, substituting tokens in text files
 * and applying the rename table. Directory names are substituted too, so a
 * template can nest under `__SRC_ROOT__`.
 */
export function copyTemplate(srcDir: string, destDir: string, tokens: Tokens): CopyResult {
  const written: string[] = [];
  if (!existsSync(srcDir)) return { written };

  for (const entry of readdirSync(srcDir)) {
    const from = join(srcDir, entry);
    const name = RENAME[entry] ?? substitute(entry, tokens);
    const to = join(destDir, name);

    if (statSync(from).isDirectory()) {
      mkdirSync(to, { recursive: true });
      written.push(...copyTemplate(from, to, tokens).written);
      continue;
    }

    mkdirSync(dirname(to), { recursive: true });
    if (isBinary(entry)) {
      cpSync(from, to);
    } else {
      writeFileSync(to, substitute(readFileSync(from, 'utf8'), tokens), 'utf8');
    }
    written.push(to);
  }
  return { written };
}

/**
 * How the generated project should refer to `@rindra/desktop`.
 *
 * Nothing is published to npm, so the default is a `link:` to this very
 * checkout — the new project picks up library edits immediately, which is what
 * you want while both are moving. Pass `--dep` to pin something portable (a git
 * tag, or a version once it is published).
 */
export function defaultDepSpec(libraryDir: string, projectDir: string): string {
  const rel = relative(projectDir, libraryDir).split(sep).join('/');
  // A relative link reads better in package.json, but only while the project
  // stays put; an absolute one survives the project being moved deeper.
  return rel.startsWith('..') && rel.split('/').length <= 6
    ? `link:${rel}`
    : `link:${resolve(libraryDir).split(sep).join('/')}`;
}
