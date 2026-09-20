import type { Metadata } from 'next';
// The library's stylesheet defines the design tokens the app's own sheet paints
// with, so it is imported first. Global CSS may only be imported here.
import '@rindra/desktop/styles.css';
import '@rindra/desktop/print.css';
import '../styles/app.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: '__APP_NAME__',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <html lang="__LOCALE__">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
