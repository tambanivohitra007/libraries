'use client';

import dynamic from 'next/dynamic';

// AccentProvider reads the stored accent during its first render, which the
// server cannot know, so a server-rendered grid would hydrate-mismatch.
// `ssr: false` is only allowed inside a Client Component, which is why this
// page carries 'use client'. Any screen rendering a DataTable wants this
// treatment; to keep a page a Server Component, move these two lines into a
// small 'use client' wrapper and render that instead.
const RecordsScreen = dynamic(() => import('../screens/RecordsScreen'), { ssr: false });

export default function Page(): React.JSX.Element {
  return <RecordsScreen />;
}
