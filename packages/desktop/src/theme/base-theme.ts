import { type ThemeConfig } from 'antd';

/**
 * Desktop-tool theme (plan §9.1): a restrained neutral palette with a single
 * accent and a crisp (not bubbly) radius. We keep antd's default sizing and
 * font — the previous compactAlgorithm + small size + reduced font stacked into
 * an uncomfortably tiny UI. Density is tuned per-region in index.css instead.
 */
export const baseTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1f6feb',
    borderRadius: 4,
    fontSize: 14,
    // Snappier than antd's defaults (0.1 / 0.2 / 0.3s): dropdowns, tooltips,
    // popovers, selects, modals and drawers settle almost at once, so the desktop
    // UI feels immediate rather than animated. Kept non-zero to avoid hard cuts.
    motionDurationFast: '0.05s',
    motionDurationMid: '0.1s',
    motionDurationSlow: '0.16s',
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      bodyBg: '#f5f6f8',
      siderBg: '#fafafa',
    },
  },
};
