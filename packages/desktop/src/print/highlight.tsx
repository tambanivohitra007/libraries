import type { ReactNode } from 'react';

/**
 * Surlignage des occurrences de recherche dans le document.
 *
 * Module interne de `print-preview`.
 */

/** Highlight every occurrence of `term` in `text`; the global Nth match (by
 *  document order, tracked in `ctx`) gets the active style + ref for scrolling. */
export function highlight(
  text: string,
  term: string,
  ctx: { n: number },
  active: number,
  activeRef: (el: HTMLElement | null) => void,
  matchCase = false,
): ReactNode {
  const tl = matchCase ? term : term.toLowerCase();
  if (!tl) return text;
  const lc = matchCase ? text : text.toLowerCase();
  const parts: ReactNode[] = [];
  let i = 0;
  let idx = lc.indexOf(tl);
  while (idx >= 0) {
    if (idx > i) parts.push(text.slice(i, idx));
    const my = ctx.n++;
    const isActive = my === active;
    parts.push(
      <mark
        key={my}
        ref={isActive ? activeRef : undefined}
        className={isActive ? 'pp-hit pp-hit--active' : 'pp-hit'}
      >
        {text.slice(idx, idx + term.length)}
      </mark>,
    );
    i = idx + term.length;
    idx = lc.indexOf(tl, i);
  }
  if (i < text.length) parts.push(text.slice(i));
  return parts;
}
