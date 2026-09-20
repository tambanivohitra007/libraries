import { useState } from 'react';
import { App as AntApp, Layout, Menu, Radio, Select, Space, Tooltip, Typography } from 'antd';
import { BgColorsOutlined, TranslationOutlined } from '@ant-design/icons';
import enUS from 'antd/locale/en_US';
import frFR from 'antd/locale/fr_FR';
import { useTranslation } from 'react-i18next';
import {
  AccentProvider,
  ACCENT_PRESETS,
  CommandsProvider,
  THEME_MODES,
  useAccent,
  type DesktopLocale,
  type ThemeMode,
} from '@rindra/desktop';
import { DemoFrame } from './DemoFrame';
import { Integration } from './Integration';
import { DEMOS, GROUPS } from './registry';

const INTEGRATION = 'integration';

/** Accent + mode switcher in the header, so every demo can be inspected in all
 *  three display modes without leaving the page. */
function ChromeControls({
  lang,
  onLang,
}: {
  lang: DesktopLocale;
  onLang: (l: DesktopLocale) => void;
}): React.JSX.Element {
  const { accentKey, setAccentKey, mode, setMode } = useAccent();
  return (
    <Space size="large">
      <Space size={6}>
        <TranslationOutlined style={{ color: 'var(--chrome-on-accent)', opacity: 0.8 }} />
        <Select
          size="small"
          value={lang}
          onChange={onLang}
          style={{ width: 120 }}
          options={[
            { value: 'fr', label: 'Français' },
            { value: 'en', label: 'English' },
            { value: 'mg', label: 'Malagasy' },
          ]}
        />
      </Space>
      <Space size={6}>
        <BgColorsOutlined style={{ color: 'var(--chrome-on-accent)', opacity: 0.8 }} />
        {ACCENT_PRESETS.map((p) => (
          <Tooltip key={p.key} title={p.key}>
            <button
              aria-label={p.key}
              className={`swatch${accentKey === p.key ? ' swatch--on' : ''}`}
              style={{ background: p.color }}
              onClick={() => setAccentKey(p.key)}
            />
          </Tooltip>
        ))}
      </Space>
      <Radio.Group
        size="small"
        value={mode}
        onChange={(e) => setMode(e.target.value as ThemeMode)}
        options={THEME_MODES.map((m) => ({ label: m, value: m }))}
        optionType="button"
      />
    </Space>
  );
}

function Gallery({
  lang,
  onLang,
}: {
  lang: DesktopLocale;
  onLang: (l: DesktopLocale) => void;
}): React.JSX.Element {
  const [selected, setSelected] = useState<string>(DEMOS[0].id);
  const demo = DEMOS.find((d) => d.id === selected);

  return (
    <Layout className="gallery">
      <Layout.Header className="gallery__header">
        <Space align="center" size="middle">
          <Typography.Text strong className="gallery__brand">
            @rindra/desktop
          </Typography.Text>
          <Typography.Text className="gallery__version">v0.1.0</Typography.Text>
        </Space>
        <ChromeControls lang={lang} onLang={onLang} />
      </Layout.Header>

      <Layout>
        <Layout.Sider width={230} theme="light" className="gallery__sider">
          <Menu
            mode="inline"
            selectedKeys={[selected]}
            onSelect={({ key }) => setSelected(key)}
            items={[
              ...GROUPS.map((g) => ({
                key: g,
                label: g,
                type: 'group' as const,
                children: DEMOS.filter((d) => d.group === g).map((d) => ({
                  key: d.id,
                  label: d.title,
                })),
              })),
              { type: 'divider' as const, key: 'sep' },
              { key: INTEGRATION, label: 'Integration' },
            ]}
          />
        </Layout.Sider>

        <Layout.Content className="gallery__content">
          {selected === INTEGRATION ? <Integration /> : demo && <DemoFrame demo={demo} />}
        </Layout.Content>
      </Layout>
    </Layout>
  );
}

/** antd ships no Malagasy bundle, so `mg` borrows the French one — its date and
 *  number conventions are the ones Madagascar uses. The grid's own strings still
 *  come from `desktopLocales.mg`. */
const ANTD_LOCALE = { fr: frFR, en: enUS, mg: frFR };

export function App(): React.JSX.Element {
  const [lang, setLang] = useState<DesktopLocale>('fr');
  const { i18n } = useTranslation();

  function changeLang(l: DesktopLocale): void {
    setLang(l);
    void i18n.changeLanguage(l);
  }

  return (
    <AccentProvider locale={ANTD_LOCALE[lang]}>
      <AntApp>
        <CommandsProvider>
          <Gallery lang={lang} onLang={changeLang} />
        </CommandsProvider>
      </AntApp>
    </AccentProvider>
  );
}
