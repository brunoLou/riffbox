import { useEffect, useState } from 'react';

const mem = new Map<string, unknown>();

/** Read a stored value without subscribing (e.g. for a summary on another screen). */
export function readStored<T>(key: string, fallback: T): T {
  return mem.has(key) ? (mem.get(key) as T) : fallback;
}

/**
 * useState whose value survives navigating away from a screen and back
 * (in memory for the session; nothing is written to disk).
 */
export function useStoredState<T>(key: string, init: T) {
  const [v, setV] = useState<T>(() => (mem.has(key) ? (mem.get(key) as T) : init));
  useEffect(() => { mem.set(key, v); }, [key, v]);
  return [v, setV] as const;
}
