import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ConfigProvider, theme as antdTheme, type ThemeConfig } from 'antd';
import type { Locale } from 'antd/es/locale';
import { baseTheme } from './base-theme';
import { useHost } from '../host/host';

export interface AccentPreset {
  key: string;
  color: string;
}

/** Word/Office-style brand accents — one active at a time (plan §9.1). */
export const ACCENT_PRESETS: AccentPreset[] = [
  { key: 'bleu', color: '#2b579a' },
  { key: 'vert', color: '#217346' },
  { key: 'orange', color: '#c43e1c' },
  { key: 'rouge', color: '#a4262c' },
  { key: 'violet', color: '#5c2d91' },
  { key: 'ardoise', color: '#3b3a39' },
];

export const THEME_MODES = ['clair', 'sombre', 'noir'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

/** Representative swatch color shown beside each mode in the picker. */
export const MODE_SWATCHES: Record<ThemeMode, string> = {
  clair: '#ffffff',
  sombre: '#1f1f1f',
  noir: '#000000',
};

const ACCENT_STORAGE_KEY = 'chromeAccent';
const MODE_STORAGE_KEY = 'chromeMode';
const DEFAULT_ACCENT_KEY = 'bleu';
const DEFAULT_MODE: ThemeMode = 'clair';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** A custom accent is stored as its own `#RRGGBB` value used directly as the key. */
export function isCustomAccent(key: string): boolean {
  return HEX_RE.test(key);
}

function resolveAccent(key: string, presets: AccentPreset[]): AccentPreset {
  if (isCustomAccent(key)) return { key, color: key };
  return presets.find((p) => p.key === key) ?? presets[0];
}

function loadAccentKey(presets: AccentPreset[], storageKey: string, fallbackKey: string): string {
  // A missing or unreadable store (private mode, cleared data) must not stop the
  // app booting — it just starts on the default accent.
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(storageKey);
  } catch {
    /* storage unavailable */
  }
  if (saved && (isCustomAccent(saved) || presets.some((p) => p.key === saved))) return saved;
  return presets.some((p) => p.key === fallbackKey) ? fallbackKey : (presets[0]?.key ?? fallbackKey);
}

function loadMode(storageKey: string, fallbackMode: ThemeMode): ThemeMode {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(storageKey);
  } catch {
    /* storage unavailable */
  }
  return THEME_MODES.includes(saved as ThemeMode) ? (saved as ThemeMode) : fallbackMode;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace('#', '');
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16),
  };
}

/** Mix a hex color toward white by `amount` (0–1), returning a hex string. */
function lighten(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const mix = (c: number): number => Math.round(c + (255 - c) * amount);
  const to2 = (n: number): string => mix(n).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

function withAlpha(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** antd theme for the chosen accent + display mode. Light uses the default
 *  algorithm; dark and black both use the dark algorithm, with black pushing the
 *  surfaces to true black for OLED-style contrast.
 *
 *  Brand accents are intentionally dark (they read on the light title band), so
 *  in dark modes the accent is too dim to use as *text* on a dark surface. We
 *  keep `colorPrimary` (so solid primary fills + white text stay correct) but
 *  brighten the accent for accent-as-text roles: selected tab/menu items and
 *  links. */
function buildTheme(color: string, mode: ThemeMode, base: ThemeConfig): ThemeConfig {
  const dark = mode !== 'clair';
  const accentText = dark ? lighten(color, 0.45) : color;

  const layout =
    mode === 'clair'
      ? { headerBg: '#ffffff', bodyBg: '#f5f6f8', siderBg: '#fafafa' }
      : mode === 'sombre'
        ? { headerBg: '#1f1f1f', bodyBg: '#141414', siderBg: '#1d1d1d' }
        : { headerBg: '#000000', bodyBg: '#000000', siderBg: '#000000' };

  const blackTokens =
    mode === 'noir'
      ? {
          colorBgLayout: '#000000',
          colorBgContainer: '#000000',
          colorBgElevated: '#141414',
          colorBorder: '#2a2a2a',
          colorBorderSecondary: '#1c1c1c',
        }
      : {};

  const linkTokens = dark
    ? { colorLink: accentText, colorLinkHover: lighten(color, 0.6), colorLinkActive: accentText }
    : {};

  return {
    ...base,
    algorithm: mode === 'clair' ? antdTheme.defaultAlgorithm : antdTheme.darkAlgorithm,
    token: { ...base.token, colorPrimary: color, ...blackTokens, ...linkTokens },
    components: {
      ...base.components,
      Layout: layout,
      Tabs: { itemSelectedColor: accentText, itemHoverColor: accentText, inkBarColor: accentText },
      Menu: {
        itemSelectedColor: accentText,
        ...(dark ? { itemSelectedBg: withAlpha(accentText, 0.16) } : {}),
      },
    },
  };
}

interface AccentContextValue {
  accentKey: string;
  /** The resolved `#RRGGBB` accent — a preset's color, or the custom value itself. */
  color: string;
  setAccentKey: (key: string) => void;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const AccentContext = createContext<AccentContextValue | null>(null);

export interface AccentProviderProps {
  children: ReactNode;
  /** Selectable brand accents. Defaults to the six Office-style presets. */
  presets?: AccentPreset[];
  /** Accent applied when nothing is stored yet. */
  defaultAccent?: string;
  /** Display mode applied when nothing is stored yet. */
  defaultMode?: ThemeMode;
  /** antd locale bundle, e.g. `import frFR from 'antd/locale/fr_FR'`. Left out,
   *  antd stays on its English default — the library ships no locale of its own
   *  so an app never pays for one it does not use. */
  locale?: Locale;
  /** antd theme the accent is layered onto. Defaults to the bundled desktop
   *  theme (crisp radius, snappy motion); pass your own to override sizing,
   *  fonts or component tokens. */
  theme?: ThemeConfig;
  /** localStorage keys, namespaced when several apps share an origin. */
  storageKeys?: { accent?: string; mode?: string };
}

/**
 * Owns the selected brand accent and display mode, feeding them to both the
 * chrome (the --chrome-accent CSS variable + a data-theme attribute that drives
 * theme-aware surface variables) and antd (colorPrimary + light/dark algorithm),
 * so the colored title band, the content accents, and light/dark/black surfaces
 * stay in sync. Both choices persist across launches in localStorage.
 */
export function AccentProvider({
  children,
  presets = ACCENT_PRESETS,
  defaultAccent = DEFAULT_ACCENT_KEY,
  defaultMode = DEFAULT_MODE,
  locale,
  theme: base = baseTheme,
  storageKeys,
}: AccentProviderProps): React.JSX.Element {
  const accentStorageKey = storageKeys?.accent ?? ACCENT_STORAGE_KEY;
  const modeStorageKey = storageKeys?.mode ?? MODE_STORAGE_KEY;
  const host = useHost();

  const [accentKey, setAccentKey] = useState<string>(() =>
    loadAccentKey(presets, accentStorageKey, defaultAccent),
  );
  const [mode, setMode] = useState<ThemeMode>(() => loadMode(modeStorageKey, defaultMode));
  const color = resolveAccent(accentKey, presets).color;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--chrome-accent', color);
    // Accent legible as text/icons on the content surface (brightened in dark).
    root.style.setProperty('--accent-readable', mode === 'clair' ? color : lighten(color, 0.45));
    root.dataset.theme = mode;
    try {
      localStorage.setItem(accentStorageKey, accentKey);
      localStorage.setItem(modeStorageKey, mode);
    } catch {
      /* storage unavailable — the choice just won't survive a restart */
    }
    // Mirror the resolved accent/mode to the host so a native splash can paint
    // its gradient in the chosen colours on the next launch.
    host.setChromePrefs?.({ accent: color, mode });
  }, [accentKey, color, mode, accentStorageKey, modeStorageKey, host]);

  const theme = useMemo(() => buildTheme(color, mode, base), [color, mode, base]);

  const value = useMemo<AccentContextValue>(
    () => ({ accentKey, color, setAccentKey, mode, setMode }),
    [accentKey, color, mode],
  );

  return (
    <AccentContext.Provider value={value}>
      {/* Disable the button "wave" ripple — that expanding ring on every click
          reads as lag on a desktop tool. */}
      <ConfigProvider locale={locale} theme={theme} wave={{ disabled: true }}>
        {children}
      </ConfigProvider>
    </AccentContext.Provider>
  );
}

export function useAccent(): AccentContextValue {
  const ctx = useContext(AccentContext);
  if (!ctx) throw new Error('useAccent must be used within an AccentProvider');
  return ctx;
}
