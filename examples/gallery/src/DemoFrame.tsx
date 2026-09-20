import { useState } from 'react';
import { App, Button, Segmented, Table, Typography } from 'antd';
import { CheckOutlined, CopyOutlined } from '@ant-design/icons';
import type { Demo } from './registry';

type Tab = 'preview' | 'code' | 'props';

export function DemoFrame({ demo }: { demo: Demo }): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('preview');
  const [copied, setCopied] = useState(false);
  const { message } = App.useApp();
  const tabs: Tab[] = demo.props ? ['preview', 'code', 'props'] : ['preview', 'code'];

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(demo.source);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard needs a secure context; the code is on screen either way.
      message.warning('Clipboard blocked by the browser — select the code instead.');
    }
  }

  return (
    <section className="demo">
      <header className="demo__head">
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {demo.title}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ margin: '4px 0 0', maxWidth: '68ch' }}>
            {demo.blurb}
          </Typography.Paragraph>
        </div>
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          options={tabs.map((t) => ({ label: t, value: t }))}
        />
      </header>

      {tab === 'preview' && (
        <div className="demo__stage">
          <demo.Component />
        </div>
      )}

      {tab === 'code' && (
        <div className="demo__code">
          <Button
            className="demo__copy"
            size="small"
            icon={copied ? <CheckOutlined /> : <CopyOutlined />}
            onClick={() => void copy()}
          >
            {copied ? 'copied' : 'copy'}
          </Button>
          <pre>
            <code>{demo.source}</code>
          </pre>
        </div>
      )}

      {tab === 'props' && demo.props && (
        <Table
          size="small"
          pagination={false}
          rowKey="name"
          dataSource={demo.props}
          columns={[
            {
              title: 'Prop',
              dataIndex: 'name',
              width: 210,
              render: (v: string) => <code>{v}</code>,
            },
            {
              title: 'Type',
              dataIndex: 'type',
              width: 230,
              render: (v: string) => <code className="demo__type">{v}</code>,
            },
            { title: 'Default', dataIndex: 'default', width: 120 },
            { title: 'Notes', dataIndex: 'note' },
          ]}
        />
      )}
    </section>
  );
}
