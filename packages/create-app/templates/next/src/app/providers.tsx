'use client';

import { App as AntApp } from 'antd';
import __ANTD_LOCALE_NAME__ from '__ANTD_LOCALE_MODULE__';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { AccentProvider, CommandsProvider } from '@rindra/desktop';
import '../i18n';

/**
 * The single client boundary. Everything in `@rindra/desktop` is browser-only —
 * it reads localStorage, measures columns and listens for keys — so keep server
 * components *above* this file rather than inside it.
 *
 * AntdRegistry collects antd's styles during SSR so the first paint is not
 * unstyled.
 */
export function Providers({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <AntdRegistry>
      <AccentProvider locale={__ANTD_LOCALE_NAME__} defaultAccent="__ACCENT__">
        <AntApp>
          <CommandsProvider>{children}</CommandsProvider>
        </AntApp>
      </AccentProvider>
    </AntdRegistry>
  );
}
