/** Guitar tunings: built-in presets and the player's own (stored on the device). */
import { readStored } from './store';

export interface Tuning {
  id: string;
  label: string;
  /** MIDI notes, low string (6) first. */
  m: number[];
  custom?: boolean;
}

export const STANDARD = [40, 45, 50, 55, 59, 64];

export const BUILTIN_TUNINGS: Tuning[] = [
  { id: 'std', label: 'Standard', m: STANDARD },
  { id: 'dropd', label: 'Drop D', m: [38, 45, 50, 55, 59, 64] },
  { id: 'openg', label: 'Open G', m: [38, 43, 50, 55, 59, 62] },
  { id: 'opene', label: 'Open E', m: [40, 47, 52, 56, 59, 64] },
  { id: 'half', label: '½ ton ↓', m: [39, 44, 49, 54, 58, 63] },
  { id: 'dadgad', label: 'DADGAD', m: [38, 45, 50, 55, 57, 62] },
  { id: 'opend', label: 'Open D', m: [38, 45, 50, 54, 57, 62] },
  { id: 'dropc', label: 'Drop C', m: [36, 43, 48, 53, 57, 62] },
];

export const CUSTOM_KEY = 'tuner.custom';
export const TUNING_KEY = 'tuner.tuning';
export const MAX_CUSTOM = 12;

/** How far a string may go from standard: down a fifth (slack), up a minor third (tension). */
export const RANGE = { down: 7, up: 3 };
export const clampString = (i: number, m: number) => Math.max(STANDARD[i] - RANGE.down, Math.min(STANDARD[i] + RANGE.up, m));
/** Above standard pitch: more tension on the string, worth a warning. */
export const isTight = (i: number, m: number) => m - STANDARD[i] >= 2;

const LETTERS = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
/** The usual way to write a tuning: its notes, low to high (“DADGAD”). */
export const tuningNotes = (m: number[]) => m.map(n => LETTERS[((n % 12) + 12) % 12]).join('');

export function allTunings(custom: Tuning[]): Tuning[] {
  return [...BUILTIN_TUNINGS, ...custom.map(t => ({ ...t, custom: true }))];
}

/** Default selection: the old index-based setting if there is one. */
export function defaultTuningId() {
  const old = readStored<number>('tuner.preset', 0);
  return BUILTIN_TUNINGS[old]?.id ?? 'std';
}

/** The tuning selected in the tuner (falls back to standard if it was deleted). */
export function currentTuning(): Tuning {
  const list = allTunings(readStored<Tuning[]>(CUSTOM_KEY, []));
  const id = readStored<string>(TUNING_KEY, defaultTuningId());
  return list.find(t => t.id === id) ?? BUILTIN_TUNINGS[0];
}

export const sameNotes = (a: number[], b: number[]) => a.length === b.length && a.every((n, i) => n === b[i]);

/** A tuning that already has these exact notes (to avoid saving duplicates). */
export function findSame(list: Tuning[], m: number[], exceptId?: string) {
  return list.find(t => t.id !== exceptId && sameNotes(t.m, m));
}

export const newTuningId = () => `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
