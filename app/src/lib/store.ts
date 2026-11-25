import { useCallback, useEffect, useState } from 'react';

/**
 * Small persistent store: values live in memory and are mirrored to
 * localStorage, so they survive reloads and app restarts.
 */
const PREFIX = 'riffbox:v1:';
const mem = new Map<string, unknown>();
/** Screens showing a key, told when another part of the app writes it. */
const subs = new Map<string, Set<(v: unknown) => void>>();

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

/**
 * Hooks that may adjust a value before it is written (e.g. stamping modification dates for the
 * transfer between devices). They receive the previous value, if any.
 */
const WRITE_HOOKS: Record<string, (prev: unknown, next: unknown) => unknown> = {};
/** For every other key (the sync dates any synced preference). */
let fallbackHook: ((key: string, prev: unknown, next: unknown) => unknown) | null = null;
export function registerFallbackWriteHook(fn: (key: string, prev: unknown, next: unknown) => unknown) { fallbackHook = fn; }
export function registerWriteHook<T>(key: string, fn: (prev: T | undefined, next: T) => T) {
  WRITE_HOOKS[key] = fn as (prev: unknown, next: unknown) => unknown;
}
let hooksOff = 0;
/** Write values exactly as given (a merge that already carries its own dates). */
export function withoutWriteHooks<R>(fn: () => R): R {
  hooksOff++;
  try { return fn(); } finally { hooksOff--; }
}

/** Write a value now (memory + disk). Per-key serializers can strip fields that must not be saved. */
export function writeStored<T>(key: string, value: T) {
  const hook = WRITE_HOOKS[key] ?? (fallbackHook ? (p: unknown, n: unknown) => fallbackHook!(key, p, n) : undefined);
  if (hook && !hooksOff) {
    const prev = load<T>(key);
    value = hook(prev.found ? prev.value : undefined, value) as T;
  }
  mem.set(key, value);
  try {
    const ser = SERIALIZERS[key];
    localStorage.setItem(PREFIX + key, JSON.stringify(ser ? ser(value) : value));
  } catch { /* quota or private mode: keep in memory */ }
  subs.get(key)?.forEach(fn => fn(value));
  if (!hooksOff) anyWrite.forEach(fn => fn(key));
}

const SERIALIZERS: Record<string, (v: unknown) => unknown> = {};
export function registerSerializer<T>(key: string, fn: (v: T) => unknown) {
  SERIALIZERS[key] = fn as (v: unknown) => unknown;
}
/** A value as it is saved on disk (transient fields stripped). */
export const serialized = (key: string, v: unknown) => (SERIALIZERS[key] ? SERIALIZERS[key](v) : v);

/**
 * A saved value of the expected shape (a list where a list is expected, a number for a number…).
 * Anything else (damaged on this device, or received from another one) is ignored: the screens get
 * the default rather than failing.
 */
export function sameShape(value: unknown, def: unknown): boolean {
  if (def === null || def === undefined) return true;
  if (Array.isArray(def)) return Array.isArray(value);
  if (typeof def === 'object') return !!value && typeof value === 'object' && !Array.isArray(value);
  return typeof value === typeof def;
}

/** Read a stored value without subscribing (e.g. for a summary on another screen). */
export function readStored<T>(key: string, fallback: T): T {
  const r = load<T>(key);
  return r.found && sameShape(r.value, fallback) ? (r.value as T) : fallback;
}

/**
 * useState whose value is persisted. Writes reach the store synchronously,
 * so a screen opened right after an update already sees it.
 */
export function useStoredState<T>(key: string, init: T) {
  const [v, setV] = useState<T>(() => {
    const r = load<T>(key);
    if (r.found && sameShape(r.value, init)) return r.value as T;
    mem.set(key, init);
    return init;
  });
  const set = useCallback((u: T | ((prev: T) => T)) => {
    const stored = mem.get(key);
    const prev = (sameShape(stored, init) ? stored : init) as T;
    const next = typeof u === 'function' ? (u as (p: T) => T)(prev) : u;
    writeStored(key, next);
    // What was written, write hooks included (e.g. modification dates).
    setV(mem.get(key) as T);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  // Another screen (e.g. the quick capture over the notebook) may write the same key.
  useEffect(() => {
    const fn = (val: unknown) => { if (sameShape(val, init)) setV(val as T); };
    let set = subs.get(key);
    if (!set) subs.set(key, (set = new Set()));
    set.add(fn);
    return () => { set!.delete(fn); };
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
  // Values only in memory (storage blocked or full) count too, as they would be saved.
  for (const [k, v] of mem) if (!(k in out)) out[k] = serialized(k, v);
  return out;
}

/** Told of every write (any key): the automatic sync waits for a quiet moment, then sends. */
const anyWrite = new Set<(key: string) => void>();
export function onAnyWrite(fn: (key: string) => void) { anyWrite.add(fn); return () => { anyWrite.delete(fn); }; }
