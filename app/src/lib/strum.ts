/**
 * Strumming patterns: a rhythm written as notes (from a Guitar Pro file, or typed from a paper
 * score) becomes down and up strokes. The hand moves like a pendulum that never stops: down on the
 * beats, up between them; a rest or a tied note is a stroke « in the air » (the hand moves, the
 * strings are not hit). Positions are counted in sixteenths of a quarter note.
 */
import { CHORD_TYPES } from './chords';
import { parseChordName, rankChords } from './chordDetect';
import { mod12 } from './music';

/** Down, up, or no stroke (the hand still moves). */
export type Stroke = 'D' | 'U' | '-';
export interface StrumBar { slots: Stroke[]; chord?: string }
export interface Rhythm {
  id: string; name: string; created: number; updated?: number;
  /** 4: beats are quarter notes (4/4, 3/4…); 8: compound time (6/8, 12/8), counted in eighths. */
  den: 4 | 8;
  bpm: number;
  /** Swung eighths (shuffle). */
  swing?: boolean;
  bars: StrumBar[];
  source?: 'gp' | 'saisie' | 'modele';
  /** Notes typed bar by bar (to edit them again). */
  notes?: RNote[][];
}

/** A note value typed from a score: length in sixteenths, rest, or tied to the previous note. */
export interface RNote { len: number; rest?: boolean; tie?: boolean }

export const NOTE_VALUES: { len: number; label: string; short: string }[] = [
  { len: 16, label: 'Ronde', short: '𝅝' },
  { len: 12, label: 'Blanche pointée', short: '𝅗𝅥.' },
  { len: 8, label: 'Blanche', short: '𝅗𝅥' },
  { len: 6, label: 'Noire pointée', short: '♩.' },
  { len: 4, label: 'Noire', short: '♩' },
  { len: 3, label: 'Croche pointée', short: '♪.' },
  { len: 2, label: 'Croche', short: '♪' },
  { len: 1, label: 'Double croche', short: '𝅘𝅥𝅯' },
];
export const noteValue = (len: number) => NOTE_VALUES.find(v => v.len === len);

/** Sixteenths in a bar of `beats` beats: a quarter is 4 of them, an eighth (compound time) 2. */
export const barSlots = (beats: number, den: 4 | 8) => beats * (den === 8 ? 2 : 4);
/** Beats in a bar, as counted (« 4 » for 4/4, « 6 » for 6/8). */
export const barBeats = (slots: number, den: 4 | 8) => slots / (den === 8 ? 2 : 4);
/** Slots per counted beat. */
export const slotsPerBeat = (den: 4 | 8) => (den === 8 ? 2 : 4);

/**
 * The direction of a stroke at a position. When the rhythm has sixteenths the hand moves in
 * sixteenths (down on each eighth, up on the « e » and « a »); otherwise in eighths (down on the
 * beat, up on the « and »).
 */
export function pendulum(slot: number, sixteenths: boolean): 'D' | 'U' {
  return sixteenths ? (slot % 2 === 0 ? 'D' : 'U') : (Math.floor(slot / 2) % 2 === 0 ? 'D' : 'U');
}

/**
 * Strokes from the onsets of a bar. `dir` forces a direction where the file says so (Guitar Pro
 * « brush » or « pickstroke »).
 */
export function strokesFromOnsets(onsets: { slot: number; dir?: 'D' | 'U' }[], slots: number): Stroke[] {
  const out: Stroke[] = new Array(slots).fill('-');
  const sixteenths = onsets.some(o => o.slot % 2 === 1);
  for (const o of onsets) if (o.slot >= 0 && o.slot < slots) out[o.slot] = o.dir ?? pendulum(o.slot, sixteenths);
  return out;
}

/** Strokes from notes typed bar by bar: each note that is played (not a rest, not tied) is a stroke. */
export function strokesFromNotes(notes: RNote[], slots: number): Stroke[] {
  const onsets: { slot: number }[] = [];
  let at = 0;
  for (const n of notes) {
    if (!n.rest && !n.tie) onsets.push({ slot: at });
    at += n.len;
  }
  return strokesFromOnsets(onsets, slots);
}
export const notesLength = (notes: RNote[]) => notes.reduce((s, n) => s + n.len, 0);

/** A bar in text: « ↓ ↓↑ ↑↓↑ » style, one character per eighth or sixteenth, « · » when no stroke. */
export function strokeText(slots: Stroke[]): string {
  const sixteenths = slots.some((s, i) => s !== '-' && i % 2 === 1);
  const step = sixteenths ? 1 : 2;
  let out = '';
  for (let i = 0; i < slots.length; i += step) out += slots[i] === 'D' ? '↓' : slots[i] === 'U' ? '↑' : '·';
  return out;
}

/** The same strokes (whatever the chord): to find the patterns a song repeats. */
export const barKey = (b: StrumBar) => b.slots.join('');

/** Distinct patterns of a song, most frequent first. */
export function commonPatterns(bars: StrumBar[]): { bar: StrumBar; count: number; first: number }[] {
  const seen = new Map<string, { bar: StrumBar; count: number; first: number }>();
  bars.forEach((b, i) => {
    if (!b.slots.some(s => s !== '-')) return; // a bar of silence is not a pattern
    const k = barKey(b);
    const e = seen.get(k);
    if (e) e.count++; else seen.set(k, { bar: { slots: b.slots }, count: 1, first: i });
  });
  return [...seen.values()].sort((a, b) => b.count - a.count || a.first - b.first);
}

const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const CANDIDATES = ROOTS.flatMap(r => CHORD_TYPES.map(t => parseChordName(r + t.sym)!)).filter(Boolean);

/** The chord a set of played notes (MIDI) forms, named as on a chord chart; null under three notes. */
export function chordFromNotes(midis: number[]): string | null {
  const pcs = [...new Set(midis.map(m => mod12(m)))];
  if (pcs.length < 2) return null;
  const bass = mod12(Math.min(...midis));
  const same = (a: number[], b: number[]) => a.length === b.length && a.every(x => b.includes(x));
  // The chord with exactly these notes, its root in the bass if possible.
  const exact = CANDIDATES.filter(c => same(c.pcs, pcs));
  if (exact.length) return (exact.find(c => c.root === bass) ?? exact[0]).name;
  // A power chord (root and fifth).
  if (pcs.length === 2 && pcs.includes(mod12(bass + 7))) return ROOTS[bass] + '5';
  if (pcs.length < 3) return null;
  const c = new Array(12).fill(0);
  pcs.forEach(p => (c[p] = 1 / pcs.length));
  return rankChords({ c, bass }, CANDIDATES)[0].name;
}

/** Ready-made patterns, to practise before importing anything. */
const P = (s: string): Stroke[] => [...s].map(ch => (ch === 'D' ? 'D' : ch === 'U' ? 'U' : '-'));
export const MODEL_RHYTHMS: Rhythm[] = [
  { id: 'm-pop', name: 'Pop / folk classique', den: 4, bpm: 90, created: 0, source: 'modele', bars: [{ slots: P('D---D-U---U-D-U-') }] },
  { id: 'm-croches', name: 'Croches régulières', den: 4, bpm: 100, created: 0, source: 'modele', bars: [{ slots: P('D-U-D-U-D-U-D-U-') }] },
  { id: 'm-rock', name: 'Rock (tout en descendant)', den: 4, bpm: 120, created: 0, source: 'modele', bars: [{ slots: P('D-D-D-D-D-D-D-D-') }] },
  { id: 'm-reggae', name: 'Reggae (contretemps)', den: 4, bpm: 76, created: 0, source: 'modele', bars: [{ slots: P('--U---U---U---U-') }] },
  { id: 'm-ballade', name: 'Ballade en 6/8', den: 8, bpm: 60, created: 0, source: 'modele', bars: [{ slots: P('D---D-U---U-') }] },
  { id: 'm-funk', name: 'Funk en doubles croches', den: 4, bpm: 92, created: 0, source: 'modele', bars: [{ slots: P('D--UD--UDU-UD-DU') }] },
  { id: 'm-shuffle', name: 'Shuffle', den: 4, bpm: 96, swing: true, created: 0, source: 'modele', bars: [{ slots: P('D-U-D-U-D-U-D-U-') }] },
];
