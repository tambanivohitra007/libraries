import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react';

/** A screen's command handlers, keyed by command id (e.g. `eleve:new`). The
 *  optional payload lets a command target a specific record (e.g. open an
 *  élève from global search). */
export type CommandMap = Record<string, ((arg?: unknown) => void) | undefined>;

interface CommandsContextValue {
  register: (ref: MutableRefObject<CommandMap>) => () => void;
  run: (key: string, arg?: unknown) => void;
  /** Command ids currently handled by a mounted screen (for enabling buttons). */
  available: Set<string>;
}

const CommandsContext = createContext<CommandsContextValue | null>(null);

/**
 * A lightweight command bus so the ribbon can invoke the *active screen's* own
 * functions instead of duplicating them. Screens register their handlers via
 * `useScreenCommands`; the ribbon dispatches by key and disables commands no
 * mounted screen handles. A dispatched-but-unavailable command is queued once,
 * so "navigate then act" works (the target screen flushes it on mount).
 */
export function CommandsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const regs = useRef<Set<MutableRefObject<CommandMap>>>(new Set());
  const pending = useRef<{ key: string; arg?: unknown } | null>(null);
  const [version, setVersion] = useState(0);

  const findHandler = useCallback((key: string): ((arg?: unknown) => void) | undefined => {
    for (const r of regs.current) {
      const h = r.current[key];
      if (h) return h;
    }
    return undefined;
  }, []);

  const register = useCallback((ref: MutableRefObject<CommandMap>) => {
    regs.current.add(ref);
    if (pending.current && ref.current[pending.current.key]) {
      const { key, arg } = pending.current;
      pending.current = null;
      ref.current[key]?.(arg);
    }
    setVersion((v) => v + 1);
    return () => {
      regs.current.delete(ref);
      setVersion((v) => v + 1);
    };
  }, []);

  const run = useCallback(
    (key: string, arg?: unknown) => {
      const h = findHandler(key);
      if (h) h(arg);
      else pending.current = { key, arg }; // a navigation will mount the screen that handles it
    },
    [findHandler],
  );

  const available = useMemo(() => {
    const s = new Set<string>();
    for (const r of regs.current)
      for (const k of Object.keys(r.current)) if (r.current[k]) s.add(k);
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const value = useMemo<CommandsContextValue>(
    () => ({ register, run, available }),
    [register, run, available],
  );
  return <CommandsContext.Provider value={value}>{children}</CommandsContext.Provider>;
}

export function useCommands(): CommandsContextValue {
  const ctx = useContext(CommandsContext);
  if (!ctx) throw new Error('useCommands must be used within a CommandsProvider');
  return ctx;
}

/**
 * Register the calling screen's command handlers (e.g. its "new" modal opener),
 * auto-unregistering on unmount. Pass the handlers fresh each render — the
 * latest closures are always used; only adding/removing a command id re-syncs.
 */
export function useScreenCommands(map: CommandMap): void {
  const { register } = useCommands();
  const ref = useRef<CommandMap>(map);
  ref.current = map;
  const sig = Object.keys(map)
    .filter((k) => map[k])
    .sort()
    .join('|');
  useEffect(() => register(ref), [register, sig]);
}
