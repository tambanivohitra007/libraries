/// <reference types="next" />

// Plain CSS side-effect imports. Next handles them at build time, but
// TypeScript rejects `import './x.css'` unless something declares the module —
// and `next-env.d.ts` only exists after the first `next dev` or `next build`.
declare module '*.css';
