#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyTemplate, defaultDepSpec, type Tokens } from './render.js';
import {
  ACCENTS,
  ANTD_LOCALE_IMPORT,
  LOCALES,
  TARGET_IDS,
  TARGETS,
  VERSIONS,
  type Accent,
  type Locale,
  type TargetId,
} from './targets.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = resolve(HERE, '../templates');
/** packages/create-app/dist → packages/desktop */
const LIBRARY = resolve(HERE, '../../desktop');

const c = {
  dim: (s: string) => `[2m${s}[0m`,
  bold: (s: string) => `[1m${s}[0m`,
  green: (s: string) => `[32m${s}[0m`,
  red: (s: string) => `[31m${s}[0m`,
  yellow: (s: string) => `[33m${s}[0m`,
  cyan: (s: string) => `[36m${s}[0m`,
};

interface Options {
  name?: string;
  target?: TargetId;
  locale?: Locale;
  accent?: Accent;
  dep?: string;
  install: boolean;
  git: boolean;
  yes: boolean;
}

function usage(): string {
  return `
${c.bold('create-rindra-app')} — scaffold a React + antd project wired to @rindra/desktop

${c.bold('Usage')}
  create-rindra-app [name] [options]

${c.bold('Options')}
  --target <${TARGET_IDS.join('|')}>   project shape
  --locale <${LOCALES.join('|')}>              starting language
  --accent <${ACCENTS.join('|')}>
  --dep <spec>                     dependency spec for @rindra/desktop
                                   ${c.dim('(default: link: to this checkout)')}
  --no-install                     skip dependency installation
  --no-git                         skip git init
  -y, --yes                        accept defaults, no prompts
  -h, --help                       show this

${c.bold('Examples')}
  create-rindra-app gestion-notes --target electron --locale fr
  create-rindra-app site --target next --yes
`;
}

function parseArgs(argv: string[]): Options | 'help' {
  const o: Options = { install: true, git: true, yes: false };
  const oneOf = <T extends string>(v: string, allowed: readonly T[], flag: string): T => {
    if (!(allowed as readonly string[]).includes(v)) {
      throw new Error(`${flag} must be one of: ${allowed.join(', ')} (got "${v}")`);
    }
    return v as T;
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = (): string => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === '-h' || a === '--help') return 'help';
    else if (a === '-y' || a === '--yes') o.yes = true;
    else if (a === '--no-install') o.install = false;
    else if (a === '--no-git') o.git = false;
    else if (a === '--target') o.target = oneOf(next(), TARGET_IDS, '--target');
    else if (a === '--locale') o.locale = oneOf(next(), LOCALES, '--locale');
    else if (a === '--accent') o.accent = oneOf(next(), ACCENTS, '--accent');
    else if (a === '--dep') o.dep = next();
    else if (a.startsWith('-')) throw new Error(`unknown option: ${a}`);
    else if (o.name === undefined) o.name = a;
    else throw new Error(`unexpected argument: ${a}`);
  }
  return o;
}

/** npm's own rules, minus the ones that cannot apply to a fresh folder name. */
function validateName(name: string): string | null {
  if (!name) return 'a name is required';
  if (name.length > 214) return 'name is too long';
  if (name.startsWith('.') || name.startsWith('_')) return 'name cannot start with . or _';
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(name)) {
    return 'use lowercase letters, digits, dashes, dots or underscores';
  }
  return null;
}

async function prompt(): Promise<{
  ask: (q: string, fallback: string) => Promise<string>;
  choose: <T extends string>(q: string, opts: readonly T[], fallback: T) => Promise<T>;
  close: () => void;
}> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return {
    ask: async (q, fallback) => (await rl.question(`${q} ${c.dim(`(${fallback})`)} `)).trim() || fallback,
    choose: async (q, opts, fallback) => {
      console.log(`\n${q}`);
      opts.forEach((o, i) => {
        const mark = o === fallback ? c.green('›') : ' ';
        console.log(`  ${mark} ${i + 1}. ${o}`);
      });
      const raw = (await rl.question(`  ${c.dim(`[1-${opts.length}, default ${fallback}]`)} `)).trim();
      if (!raw) return fallback;
      const n = Number(raw);
      if (Number.isInteger(n) && n >= 1 && n <= opts.length) return opts[n - 1];
      return (opts as readonly string[]).includes(raw) ? (raw as (typeof opts)[number]) : fallback;
    },
    close: () => rl.close(),
  };
}

function run(cmd: string, args: string[], cwd: string): void {
  execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed === 'help') {
    console.log(usage());
    return;
  }
  const opts = parsed;

  console.log(`\n${c.bold('create-rindra-app')}\n`);

  // The library is consumed as a link, so an unbuilt checkout would produce a
  // project that cannot resolve it. Better to say so now than at first import.
  if (!opts.dep && !existsSync(join(LIBRARY, 'dist', 'index.js'))) {
    console.log(c.yellow('  @rindra/desktop is not built yet — building it first.\n'));
    run('pnpm', ['--filter', '@rindra/desktop', 'build'], resolve(LIBRARY, '../..'));
    console.log('');
  }

  const interactive = !opts.yes && process.stdin.isTTY;
  let name = opts.name;
  let target = opts.target;
  let locale = opts.locale;
  let accent = opts.accent;

  if (interactive) {
    const p = await prompt();
    try {
      if (!name) name = await p.ask('Project name', 'mon-app');
      if (!target) {
        target = await p.choose(
          'Project type',
          TARGET_IDS.map((id) => id),
          'electron',
        );
        console.log(c.dim(`  ${TARGETS[target].blurb}`));
      }
      if (!locale) locale = await p.choose('Language', LOCALES, 'fr');
      if (!accent) accent = await p.choose('Accent', ACCENTS, 'bleu');
    } finally {
      p.close();
    }
  }

  name ??= 'mon-app';
  target ??= 'electron';
  locale ??= 'fr';
  accent ??= 'bleu';

  const nameError = validateName(name);
  if (nameError) throw new Error(`invalid project name: ${nameError}`);

  const projectDir = isAbsolute(name) ? name : resolve(process.cwd(), name);
  if (existsSync(projectDir) && readdirSync(projectDir).length > 0) {
    throw new Error(`${projectDir} already exists and is not empty`);
  }

  const spec = TARGETS[target];
  const dep = opts.dep ?? defaultDepSpec(LIBRARY, projectDir);
  const antd = ANTD_LOCALE_IMPORT[locale];

  const tokens: Tokens = {
    APP_NAME: basename(projectDir),
    TARGET: target,
    TARGET_LABEL: spec.label,
    SRC_ROOT: spec.srcRoot,
    LOCALE: locale,
    ACCENT: accent,
    DESKTOP_DEP: dep,
    ANTD_LOCALE_MODULE: antd.module,
    ANTD_LOCALE_NAME: antd.name,
    TARGET_NOTES: spec.notes.join('\n'),
    DEV_COMMAND: spec.devCommand,
    ...Object.fromEntries(
      Object.entries(VERSIONS).map(([k, v]) => [
        `V_${k.replace(/[A-Z]/g, (m) => `_${m}`).toUpperCase()}`,
        v,
      ]),
    ),
  };

  mkdirSync(projectDir, { recursive: true });
  // Three layers, applied in order so each may override the last: `common` at
  // the project root, `base` inside the target's own source root, then the
  // target's own tree.
  const layers = [
    copyTemplate(join(TEMPLATES, 'common'), projectDir, tokens),
    copyTemplate(join(TEMPLATES, 'base'), join(projectDir, spec.srcRoot), tokens),
    copyTemplate(join(TEMPLATES, target), projectDir, tokens),
  ];
  const fileCount = layers.reduce((n, l) => n + l.written.length, 0);

  console.log(`\n  ${c.green('created')} ${projectDir}`);
  console.log(`  ${c.dim(`${spec.label} · ${locale} · ${accent} · ${fileCount} files`)}`);
  console.log(`  ${c.dim(`@rindra/desktop  ${dep}`)}`);

  if (opts.git) {
    try {
      run('git', ['init', '-q'], projectDir);
    } catch {
      console.log(c.dim('  (git init skipped)'));
    }
  }

  if (opts.install) {
    console.log(`\n  ${c.dim('installing dependencies…')}\n`);
    run('pnpm', ['install'], projectDir);
  }

  console.log(`\n${c.bold('  Next')}`);
  console.log(`    cd ${basename(projectDir)}`);
  if (!opts.install) console.log('    pnpm install');
  console.log(`    ${spec.devCommand}\n`);
  console.log(c.dim(`  The generated CLAUDE.md documents the wiring for future edits.\n`));
}

main().catch((err: unknown) => {
  console.error(`\n${c.red('  error')}  ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
