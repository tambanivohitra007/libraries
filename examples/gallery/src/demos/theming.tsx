import { Button, Card, ColorPicker, Radio, Space, Table, Tag } from 'antd';
import {
  ACCENT_PRESETS,
  MODE_SWATCHES,
  THEME_MODES,
  useAccent,
  type ThemeMode,
} from '@rindra/desktop';

const TOKENS = [
  '--chrome-accent',
  '--accent-readable',
  '--app-bg',
  '--surface-bar',
  '--table-surface',
  '--hairline',
  '--text-secondary',
  '--text-tertiary',
];

/**
 * `AccentProvider` writes the chosen accent and mode to CSS variables *and* to
 * antd's theme, so hand-painted chrome and antd components never disagree. Both
 * choices persist in localStorage — reload the page and they survive.
 */
export default function ThemingDemo(): React.JSX.Element {
  const { accentKey, color, setAccentKey, mode, setMode } = useAccent();

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card size="small" title="Accent">
        <Space wrap>
          {ACCENT_PRESETS.map((p) => (
            <Button
              key={p.key}
              onClick={() => setAccentKey(p.key)}
              type={accentKey === p.key ? 'primary' : 'default'}
              icon={
                <span
                  style={{
                    display: 'inline-block',
                    width: 12,
                    height: 12,
                    borderRadius: 2,
                    background: p.color,
                  }}
                />
              }
            >
              {p.key}
            </Button>
          ))}
          <ColorPicker
            value={color}
            onChangeComplete={(c) => setAccentKey(c.toHexString())}
            showText={() => 'personnalisé'}
          />
        </Space>
      </Card>

      <Card size="small" title="Mode d’affichage">
        <Radio.Group value={mode} onChange={(e) => setMode(e.target.value as ThemeMode)}>
          {THEME_MODES.map((m) => (
            <Radio.Button key={m} value={m}>
              <Space size={6}>
                <span
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: MODE_SWATCHES[m],
                    border: '1px solid var(--hairline)',
                  }}
                />
                {m}
              </Space>
            </Radio.Button>
          ))}
        </Radio.Group>
      </Card>

      <Card size="small" title="Jetons résolus">
        <Table
          size="small"
          pagination={false}
          rowKey="name"
          dataSource={TOKENS.map((name) => ({
            name,
            value: getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
          }))}
          columns={[
            { title: 'Variable', dataIndex: 'name', render: (v: string) => <code>{v}</code> },
            {
              title: 'Valeur',
              dataIndex: 'value',
              render: (v: string) => (
                <Space>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 14,
                      height: 14,
                      borderRadius: 2,
                      background: v || 'transparent',
                      border: '1px solid var(--hairline)',
                    }}
                  />
                  <Tag>{v || '—'}</Tag>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
