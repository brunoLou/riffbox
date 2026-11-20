import { useCallback, useState } from 'react';

const mem = new Map<string, unknown>();

/** Read a stored value without subscribing (e.g. for a summary on another screen). */
export function readStored<T>(key: string, fallback: T): T {
  return mem.has(key) ? (mem.get(key) as T) : fallback;
}

/**
 * useState whose value survives navigating away from a screen and back
 * (in memory for the session; nothing is written to disk).
 * Writes reach the store synchronously, so a screen opened right after
 * an update (e.g. a just-created setlist) already sees it.
 */
export function useStoredState<T>(key: string, init: T) {
  const [v, setV] = useState<T>(() => {
    if (!mem.has(key)) mem.set(key, init);
    return mem.get(key) as T;
  });
  const set = useCallback((u: T | ((prev: T) => T)) => {
    const prev = mem.get(key) as T;
    const next = typeof u === 'function' ? (u as (p: T) => T)(prev) : u;
    mem.set(key, next);
    setV(next);
  }, [key]);
  return [v, set] as const;
}
