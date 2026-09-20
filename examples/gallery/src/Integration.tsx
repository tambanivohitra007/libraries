import { Alert, Steps, Tabs, Typography } from 'antd';

interface Step {
  title: string;
  body: string;
  code?: string;
}

const COMMON_I18N = `// src/i18n.ts — the grid looks up 54 keys under \`table.*\`.
// Spread yours last so your wording wins on any key you override.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { desktopLocales } from '@rindra/desktop';
import fr from './locales/fr.json';

void i18n.use(initReactI18next).init({
  lng: 'fr',
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
  resources: {
    fr: { translation: { ...desktopLocales.fr, ...fr } },
  },
});`;

const PROVIDERS = `import { App as AntApp } from 'antd';
import frFR from 'antd/locale/fr_FR';
import { AccentProvider, CommandsProvider } from '@rindra/desktop';
import '@rindra/desktop/styles.css';
import './styles/app.css';   // yours AFTER, so app rules win

export function Root() {
  return (
    <AccentProvider locale={frFR}>
      <AntApp>
        <CommandsProvider>
          <Screen />
        </CommandsProvider>
      </AntApp>
    </AccentProvider>
  );
}`;

const VITE: Step[] = [
  {
    title: 'Install',
    body: 'The peers are what a React + antd app already has.',
    code: `pnpm add @rindra/desktop
pnpm add antd @ant-design/icons react-i18next i18next`,
  },
  {
    title: 'Initialise i18next',
    body: 'Skip this and the toolbar renders raw keys like "table.export".',
    code: COMMON_I18N,
  },
  {
    title: 'Mount the providers',
    body: 'AntApp is antd’s own and is required — the grid raises notifications through App.useApp().',
    code: PROVIDERS,
  },
  {
    title: 'Use the grid',
    body: 'No host adapter needed. CSV export falls back to a browser download.',
    code: `<DataTable tableId="eleves" rowKey="id" columns={columns} dataSource={rows}
           exportName="eleves" groupable filterable searchable />`,
  },
];

const ELECTRON: Step[] = [
  {
    title: 'Install',
    body: 'Same as any React app; the library itself has no Electron dependency.',
    code: `pnpm add @rindra/desktop
pnpm add antd @ant-design/icons react-i18next i18next`,
  },
  {
    title: 'Initialise i18next',
    body: 'Identical to the Vite setup.',
    code: COMMON_I18N,
  },
  {
    title: 'Expose file operations from the preload',
    body: 'These are the only things the chrome cannot do itself.',
    code: `// src/main/index.ts
ipcMain.handle('doc:save', async (_e, name: string, content: string, filter) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: name,
    filters: filter ? [filter] : undefined,
  });
  if (canceled || !filePath) return null;           // null = user cancelled
  await writeFile(filePath, content, 'utf8');
  return filePath;
});
ipcMain.handle('doc:reveal', (_e, p: string) => shell.showItemInFolder(p));
ipcMain.handle('doc:open', async (_e, p: string) => !(await shell.openPath(p)));

// src/preload/index.ts
contextBridge.exposeInMainWorld('api', {
  saveDocument: (n, c, f) => ipcRenderer.invoke('doc:save', n, c, f),
  revealFile: (p) => ipcRenderer.invoke('doc:reveal', p),
  openFile: (p) => ipcRenderer.invoke('doc:open', p),
});`,
  },
  {
    title: 'Wire the host adapter',
    body: 'Wrap the providers in DesktopHostProvider. Now export opens a real save dialog, and the success notification can offer to reveal or open the file.',
    code: `import { DesktopHostProvider, type DesktopHost } from '@rindra/desktop';

const host: DesktopHost = {
  saveDocument: (name, content, filter) => window.api.saveDocument(name, content, filter),
  revealFile: (p) => window.api.revealFile(p),
  openFile: (p) => window.api.openFile(p),
};

<DesktopHostProvider host={host}>
  <AccentProvider locale={frFR}>…</AccentProvider>
</DesktopHostProvider>`,
  },
];

const NEXT: Step[] = [
  {
    title: 'Install',
    body: 'antd 6 supports React 19 directly — no compatibility patch needed.',
    code: `pnpm add @rindra/desktop
pnpm add antd @ant-design/icons react-i18next i18next @ant-design/nextjs-registry`,
  },
  {
    title: 'Import the stylesheet in the layout',
    body: 'Global CSS may only be imported from app/layout.tsx in the App Router.',
    code: `// app/layout.tsx
import '@rindra/desktop/styles.css';
import './globals.css';`,
  },
  {
    title: 'Create a client boundary',
    body: 'The whole library is client-side: it reads localStorage, measures columns and listens for keys. Keep it out of the server graph behind one "use client" file.',
    code: `// app/providers.tsx
'use client';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { App as AntApp } from 'antd';
import frFR from 'antd/locale/fr_FR';
import { AccentProvider, CommandsProvider } from '@rindra/desktop';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AntdRegistry>
      <AccentProvider locale={frFR}>
        <AntApp>
          <CommandsProvider>{children}</CommandsProvider>
        </AntApp>
      </AccentProvider>
    </AntdRegistry>
  );
}`,
  },
  {
    title: 'Load the grid without SSR',
    body: 'AccentProvider reads the saved accent during its first render, which the server cannot know — rendered on the server it would hydrate-mismatch. Import the screen dynamically instead.',
    code: `// app/eleves/page.tsx
import dynamic from 'next/dynamic';

const EcranEleves = dynamic(() => import('./EcranEleves'), { ssr: false });

export default function Page() {
  return <EcranEleves />;
}`,
  },
];

function StepList({ steps }: { steps: Step[] }): React.JSX.Element {
  return (
    <Steps
      direction="vertical"
      current={-1}
      items={steps.map((s) => ({
        title: s.title,
        status: 'process' as const,
        description: (
          <div className="integration__step">
            <Typography.Paragraph type="secondary" style={{ marginBottom: s.code ? 8 : 0 }}>
              {s.body}
            </Typography.Paragraph>
            {s.code && (
              <pre>
                <code>{s.code}</code>
              </pre>
            )}
          </div>
        ),
      }))}
    />
  );
}

export function Integration(): React.JSX.Element {
  return (
    <section className="demo">
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        Integrating into a project
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ maxWidth: '68ch' }}>
        The package is React + antd and nothing else, so it drops into any of the three shapes
        below. The only difference between them is how files get saved.
      </Typography.Paragraph>

      <Alert
        type="info"
        showIcon
        style={{ margin: '12px 0 20px' }}
        message="What each target changes"
        description={
          <>
            <strong>Vite SPA</strong> — nothing to wire; CSV downloads through the browser.{' '}
            <strong>Electron</strong> — add a host adapter for native save / reveal / open.{' '}
            <strong>Next.js</strong> — add a client boundary and skip SSR for the grid.
          </>
        }
      />

      <Tabs
        items={[
          { key: 'vite', label: 'Vite SPA', children: <StepList steps={VITE} /> },
          { key: 'electron', label: 'Electron', children: <StepList steps={ELECTRON} /> },
          { key: 'next', label: 'Next.js', children: <StepList steps={NEXT} /> },
        ]}
      />
    </section>
  );
}
