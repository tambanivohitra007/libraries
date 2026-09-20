// Components that ship their own stylesheet import it directly; TypeScript
// rejects a side-effect import of a non-module without this.
declare module '*.css';
