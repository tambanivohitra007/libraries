/**
 * What distinguishes the three project shapes. Everything else — the i18n
 * bootstrap, the example screen, the app stylesheet — is shared and lives in
 * `templates/base`, written into each target's own source root.
 */

/** Versions the generated projects pin. One place to bump them all. */
export const VERSIONS = {
  react: '^19.2.7',
  reactDom: '^19.2.7',
  antd: '^6.4.3',
  antdIcons: '^6.2.5',
  i18next: '^26.3.0',
  reactI18next: '^17.0.8',
  typesReact: '^19.0.0',
  typesReactDom: '^19.0.0',
  typesNode: '^22.10.5',
  typescript: '^6.0.3',
  vite: '^8.0.16',
  viteReact: '^6.0.2',
  electron: '^42.3.2',
  electronVite: '^5.0.0',
  electronBuilder: '^26.8.1',
  next: '^15.5.4',
  nextjsRegistry: '^1.0.2',
} as const;

export type TargetId = 'vite' | 'electron' | 'next';

export interface Target {
  id: TargetId;
  label: string;
  blurb: string;
  /** Where `templates/base` files land, relative to the project root. */
  srcRoot: string;
  /** Command that starts the dev server, for the closing instructions. */
  devCommand: string;
  /** Extra lines appended to the generated CLAUDE.md, target-specific. */
  notes: string[];
}

export const TARGETS: Record<TargetId, Target> = {
  vite: {
    id: 'vite',
    label: 'Vite SPA',
    blurb: 'Plain browser app. Nothing to wire; CSV export downloads through the browser.',
    srcRoot: 'src',
    devCommand: 'pnpm dev',
    notes: [
      'No host adapter is configured, so `saveDocument` falls back to an anchor download',
      'and the "reveal / open" buttons on the export notification do not appear. Add a',
      '`DesktopHostProvider` only if this app later gains a backend that can write files.',
    ],
  },
  electron: {
    id: 'electron',
    label: 'Electron desktop',
    blurb: 'electron-vite + a host adapter wired to native save / reveal / open dialogs.',
    srcRoot: 'src/renderer/src',
    devCommand: 'pnpm dev',
    notes: [
      'The host adapter lives in `src/renderer/src/host.ts` and is wired to the preload',
      'bridge in `src/preload/index.ts`, whose IPC handlers are in `src/main/index.ts`.',
      'Adding a new native capability means touching all three — main, preload, renderer.',
      'Never reach for `window.api` from a screen; go through the host adapter so the',
      'code stays runnable in a browser.',
    ],
  },
  next: {
    id: 'next',
    label: 'Next.js (App Router)',
    blurb: 'Client boundary + ssr:false for the grid, because the chrome is browser-only.',
    srcRoot: 'src',
    devCommand: 'pnpm dev',
    notes: [
      'The whole library is client-side. `src/app/providers.tsx` is the single "use client"',
      'boundary; keep server components above it.',
      'Screens using the grid are imported with `dynamic(..., { ssr: false })`, because',
      'AccentProvider reads the stored accent on first render and would otherwise',
      'hydrate-mismatch. Follow that pattern for any new screen that renders a DataTable.',
    ],
  },
};

export const TARGET_IDS = Object.keys(TARGETS) as TargetId[];

export const ACCENTS = ['bleu', 'vert', 'orange', 'rouge', 'violet', 'ardoise'] as const;
export type Accent = (typeof ACCENTS)[number];

export const LOCALES = ['fr', 'en', 'mg'] as const;
export type Locale = (typeof LOCALES)[number];

/** antd ships no Malagasy bundle; `mg` borrows the French one, whose date and
 *  number conventions are the ones Madagascar uses. */
export const ANTD_LOCALE_IMPORT: Record<Locale, { module: string; name: string }> = {
  fr: { module: 'antd/locale/fr_FR', name: 'frFR' },
  en: { module: 'antd/locale/en_US', name: 'enUS' },
  mg: { module: 'antd/locale/fr_FR', name: 'frFR' },
};
