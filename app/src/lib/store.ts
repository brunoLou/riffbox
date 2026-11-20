import { useCallback, useState } from 'react';

/**
 * Small persistent store: values live in memory and are mirrored to
 * localStorage, so they survive reloads and app restarts.
 */
const PREFIX = 'riffbox:v1:';
const mem = new Map<string, unknown>();

function load<T>(key: string): { found: boolean; value?: T } {
  if (mem.has(key)) return { found: true, value: mem.get(key) as T };
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw !== null) {
      const value = JSON.parse(raw) as T;
      mem.set(key, value);
      return { found: true, value };
    }
  } catch { /* storage blocked or corrupt: fall back to defaults */ }
  return { found: false };
}

/** Write a value now (memory + disk). Per-key serializers can strip fields that must not be saved. */
export function writeStored<T>(key: string, value: T) {
  mem.set(key, value);
  try {
    const ser = SERIALIZERS[key];
    localStorage.setItem(PREFIX + key, JSON.stringify(ser ? ser(value) : value));
  } catch { /* quota or private mode: keep in memory */ }
}

const SERIALIZERS: Record<string, (v: unknown) => unknown> = {};
export function registerSerializer<T>(key: string, fn: (v: T) => unknown) {
  SERIALIZERS[key] = fn as (v: unknown) => unknown;
}

/** Read a stored value without subscribing (e.g. for a summary on another screen). */
export function readStored<T>(key: string, fallback: T): T {
  const r = load<T>(key);
  return r.found ? (r.value as T) : fallback;
}

/**
 * useState whose value is persisted. Writes reach the store synchronously,
 * so a screen opened right after an update already sees it.
 */
export function useStoredState<T>(key: string, init: T) {
  const [v, setV] = useState<T>(() => {
    const r = load<T>(key);
    if (r.found) return r.value as T;
    mem.set(key, init);
    return init;
  });
  const set = useCallback((u: T | ((prev: T) => T)) => {
    const prev = mem.get(key) as T;
    const next = typeof u === 'function' ? (u as (p: T) => T)(prev) : u;
    writeStored(key, next);
    setV(next);
  }, [key]);
  return [v, set] as const;
}

/** Ask the browser not to evict our data under storage pressure (best effort). */
export function requestPersistence() {
  try { void navigator.storage?.persist?.(); } catch { /* ignore */ }
}

/** Erase every saved value (memory and disk). The caller reloads the app afterwards. */
export function clearAllStored() {
  mem.clear();
  try {
    Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

/** Approximate size of the saved values, in bytes. */
export function storedBytes() {
  let n = 0;
  try { for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) n += (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2; } catch { /* ignore */ }
  return n;
}

/** Every saved value, as stored on disk (for backups). */
export function allStored(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith(PREFIX)) continue;
      try { out[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k) ?? 'null'); } catch { /* skip corrupt value */ }
    }
  } catch { /* storage blocked */ }
  return out;
}
