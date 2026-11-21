/** Chord library: chord types, CAGED shapes and movable voicings. */
import { STR_PC, mod12 } from './music';

/** Open-string MIDI notes, low E to high e. */
export const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
export const LETTERS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export type Shape = 'C' | 'A' | 'G' | 'E' | 'D';
export const SHAPE_FR: Record<Shape, string> = { C: 'Do', A: 'La', G: 'Sol', E: 'Mi', D: 'Ré' };

/**
 * A shape as played in its open position, written relative to the fret `r` of the root
 * on `root` (string index, 0 = low E). `off` = fret offset per string, null = not played.
 */
interface Template { shape: Shape; root: number; off: (number | null)[] }

export interface ChordType {
  id: string; sym: string; fr: string;
  /** Intervals from the root, in semitones, with their label. */
  ivs: [number, string][];
  /** Interval semitones that may be left out (the fifth of four-note chords). */
  optional?: number[];
  templates: Template[];
}

const t = (shape: Shape, root: number, off: (number | null)[]): Template => ({ shape, root, off });
const _ = null;

export const CHORD_TYPES: ChordType[] = [
  { id: 'maj', sym: '', fr: 'majeur', ivs: [[0, '1'], [4, '3'], [7, '5']], templates: [
    t('C', 1, [_, 0, -1, -3, -2, -3]), t('A', 1, [_, 0, 2, 2, 2, 0]), t('G', 0, [0, -1, -3, -3, -3, 0]),
    t('E', 0, [0, 2, 2, 1, 0, 0]), t('D', 2, [_, _, 0, 2, 3, 2])] },
  { id: 'm', sym: 'm', fr: 'mineur', ivs: [[0, '1'], [3, '♭3'], [7, '5']], templates: [
    t('C', 1, [_, 0, -2, -3, -2, _]), t('A', 1, [_, 0, 2, 2, 1, 0]), t('G', 0, [0, -2, -3, -3, 0, 0]),
    t('E', 0, [0, 2, 2, 0, 0, 0]), t('D', 2, [_, _, 0, 2, 3, 1])] },
  { id: '7', sym: '7', fr: 'septième', ivs: [[0, '1'], [4, '3'], [7, '5'], [10, '♭7']], optional: [7], templates: [
    t('C', 1, [_, 0, -1, 0, -2, -3]), t('A', 1, [_, 0, 2, 0, 2, 0]), t('G', 0, [0, -1, -3, -3, -3, -2]),
    t('E', 0, [0, 2, 0, 1, 0, 0]), t('D', 2, [_, _, 0, 2, 1, 2])] },
  { id: 'maj7', sym: 'maj7', fr: 'septième majeure', ivs: [[0, '1'], [4, '3'], [7, '5'], [11, '7']], optional: [7], templates: [
    t('C', 1, [_, 0, -1, -3, -3, -3]), t('A', 1, [_, 0, 2, 1, 2, 0]), t('G', 0, [0, -1, -3, -3, -3, -1]),
    t('E', 0, [0, 2, 1, 1, 0, 0]), t('D', 2, [_, _, 0, 2, 2, 2])] },
  { id: 'm7', sym: 'm7', fr: 'mineur septième', ivs: [[0, '1'], [3, '♭3'], [7, '5'], [10, '♭7']], optional: [7], templates: [
    t('C', 1, [_, 0, -2, 0, -2, _]), t('A', 1, [_, 0, 2, 0, 1, 0]), t('G', 0, [0, _, 0, 0, 0, _]),
    t('E', 0, [0, 2, 2, 0, 3, 0]), t('D', 2, [_, _, 0, 2, 1, 1])] },
  { id: 'sus2', sym: 'sus2', fr: 'suspendu 2', ivs: [[0, '1'], [2, '2'], [7, '5']], templates: [
    t('A', 1, [_, 0, 2, 2, 0, 0]), t('E', 0, [0, 2, 4, 4, 0, 0]), t('D', 2, [_, _, 0, 2, 3, 0])] },
  { id: 'sus4', sym: 'sus4', fr: 'suspendu 4', ivs: [[0, '1'], [5, '4'], [7, '5']], templates: [
    t('A', 1, [_, 0, 2, 2, 3, 0]), t('E', 0, [0, 2, 2, 2, 0, 0]), t('D', 2, [_, _, 0, 2, 3, 3])] },
  { id: '7sus4', sym: '7sus4', fr: 'septième suspendu 4', ivs: [[0, '1'], [5, '4'], [7, '5'], [10, '♭7']], optional: [7], templates: [
    t('A', 1, [_, 0, 2, 0, 3, 0]), t('E', 0, [0, 2, 0, 2, 0, 0]), t('D', 2, [_, _, 0, 2, 1, 3])] },
  { id: '6', sym: '6', fr: 'sixte', ivs: [[0, '1'], [4, '3'], [7, '5'], [9, '6']], optional: [7], templates: [
    t('C', 1, [_, 0, -1, -1, -2, -3]), t('A', 1, [_, 0, 2, 2, 2, 2]), t('E', 0, [0, 2, 2, 1, 2, 0])] },
  { id: 'm6', sym: 'm6', fr: 'mineur sixte', ivs: [[0, '1'], [3, '♭3'], [7, '5'], [9, '6']], optional: [7], templates: [
    t('A', 1, [_, 0, 2, 2, 1, 2]), t('E', 0, [0, 2, 2, 0, 2, 0]), t('D', 2, [_, _, 0, 2, 0, 1])] },
  { id: 'add9', sym: 'add9', fr: 'neuvième ajoutée', ivs: [[0, '1'], [4, '3'], [7, '5'], [2, '9']], templates: [
    t('C', 1, [_, 0, -1, -3, 0, -3]), t('A', 1, [_, 0, 2, 4, 2, 0]), t('E', 0, [0, 2, 4, 1, 0, 0])] },
  { id: '9', sym: '9', fr: 'neuvième', ivs: [[0, '1'], [4, '3'], [7, '5'], [10, '♭7'], [2, '9']], optional: [7], templates: [
    t('C', 1, [_, 0, -1, 0, 0, _]), t('E', 0, [0, 2, 0, 1, 0, 2])] },
  { id: 'dim', sym: 'dim', fr: 'diminué', ivs: [[0, '1'], [3, '♭3'], [6, '♭5']], templates: [
    t('A', 1, [_, 0, 1, 2, 1, _]), t('E', 0, [0, 1, 2, 0, _, _]), t('D', 2, [_, _, 0, 1, 3, 1])] },
  { id: 'dim7', sym: 'dim7', fr: 'diminué septième', ivs: [[0, '1'], [3, '♭3'], [6, '♭5'], [9, '♭♭7']], templates: [
    t('A', 1, [_, 0, 1, 2, 1, 2]), t('E', 0, [0, 1, 2, 0, 2, 0]), t('D', 2, [_, _, 0, 1, 0, 1])] },
  { id: 'aug', sym: 'aug', fr: 'augmenté', ivs: [[0, '1'], [4, '3'], [8, '♯5']], templates: [
    t('C', 1, [_, 0, -1, -2, -2, -3]), t('A', 1, [_, 0, 3, 2, 2, 1]), t('E', 0, [0, 3, 2, 1, 1, 0])] },
  { id: 'm7b5', sym: 'm7♭5', fr: 'demi-diminué', ivs: [[0, '1'], [3, '♭3'], [6, '♭5'], [10, '♭7']], templates: [
    t('A', 1, [_, 0, 1, 0, 1, _]), t('E', 0, [0, 1, 0, 0, 3, 0]), t('D', 2, [_, _, 0, 1, 1, 1])] },
  { id: '5', sym: '5', fr: 'quinte (power chord)', ivs: [[0, '1'], [7, '5']], templates: [
    t('E', 0, [0, 2, 2, _, _, _]), t('A', 1, [_, 0, 2, 2, _, _]), t('D', 2, [_, _, 0, 2, 3, _])] },
];

export const chordType = (id: string) => CHORD_TYPES.find(c => c.id === id) ?? CHORD_TYPES[0];
export const chordSymbol = (root: number, type: ChordType) => LETTERS[mod12(root)] + type.sym;

export interface Voicing {
  /** CAGED shape (positions); absent for inversions. */
  shape?: Shape;
  /** Inversion: 0 = root in the bass, 1 = third, 2 = fifth, 3 = seventh (or the chord's 4th tone). */
  inv?: number;
  /** Inversion's string group, index into STRING_SETS. */
  set?: number;
  /** Fret per string, low E to high e; null = not played. */
  frets: (number | null)[];
  /** First fret shown in the diagram (1 = nut). */
  base: number;
}

/** A position from the CAGED system: always has its shape. */
export interface CagedVoicing extends Voicing { shape: Shape }

const MAX_FRET = 15;

/** Every template of the type moved to this root, lowest position first. */
export function voicings(root: number, type: ChordType): CagedVoicing[] {
  const out: CagedVoicing[] = [];
  for (const tpl of type.templates) {
    const offs = tpl.off.filter((o): o is number => o !== null);
    const lo = Math.min(...offs), hi = Math.max(...offs);
    let r = mod12(root - STR_PC[tpl.root]);
    while (r + lo < 0) r += 12;
    if (r + hi > MAX_FRET && r - 12 + lo >= 0) r -= 12;
    if (r + hi > MAX_FRET) continue;
    const frets = tpl.off.map(o => (o === null ? null : r + o));
    const fretted = frets.filter((f): f is number => f !== null && f > 0);
    const top = fretted.length ? Math.max(...fretted) : 0;
    const base = top <= 4 ? 1 : Math.min(...fretted);
    let v: CagedVoicing = { shape: tpl.shape, frets, base };
    // A shape moved up the neck can need five fingers: leave out the top string when the chord
    // keeps all its notes without it (the bass stays).
    if (!playable(v)) v = trimToPlayable(v, root, type) ?? v;
    out.push(v);
  }
  return out.sort((a, b) => minFret(a) - minFret(b));
}
function trimToPlayable(v: CagedVoicing, root: number, type: ChordType): CagedVoicing | null {
  const played = v.frets.map((f, i) => (f === null ? -1 : i)).filter(i => i >= 0);
  const required = type.ivs.filter(([iv]) => !type.optional?.includes(iv)).map(([iv]) => mod12(root + iv));
  const pcOf = (i: number) => mod12(OPEN_MIDI[i] + v.frets[i]!);
  // The top string, else a string doubling a note played elsewhere (never the bass).
  const doubled = played.slice(1).filter(i => played.some(j => j !== i && pcOf(j) === pcOf(i)));
  for (const drop of [played[played.length - 1], ...doubled]) {
    const frets = v.frets.map((f, i) => (i === drop ? null : f));
    const pcs = frets.flatMap((f, i) => (f === null ? [] : [mod12(OPEN_MIDI[i] + f)]));
    if (!required.every(pc => pcs.includes(pc))) continue;
    const fr = frets.filter((f): f is number => f !== null && f > 0);
    const top = fr.length ? Math.max(...fr) : 0;
    const w: CagedVoicing = { ...v, frets, base: top <= 4 ? 1 : Math.min(...fr) };
    if (playable(w)) return w;
  }
  return null;
}
const minFret = (v: Voicing) => Math.min(...v.frets.filter((f): f is number => f !== null));

/** Position of a voicing: 0 when it uses open strings, else its lowest fret. */
export const capPos = (v: Voicing) => {
  if (v.frets.includes(0)) return 0;
  const fr = v.frets.filter((f): f is number => f !== null && f > 0);
  return fr.length ? Math.min(...fr) : 0;
};

/** Sounding MIDI notes of a voicing, low to high. */
export const voicingMidi = (v: Voicing) => v.frets.flatMap((f, s) => (f === null ? [] : [OPEN_MIDI[s] + f]));

/** Interval label of a pitch class in the chord, or null if it is not a chord tone. */
export function intervalOf(root: number, type: ChordType, pc: number): string | null {
  const iv = mod12(pc - root);
  return type.ivs.find(([s]) => s === iv)?.[1] ?? null;
}

/* ---------- Fingering ---------- */

export interface Fingering {
  /** Finger per string, low E to high e: 1 index … 4 little finger, 0 open, null not played. */
  fingers: (number | null)[];
  /** Index finger laid across strings `from`–`to` at `fret`. */
  barre: { fret: number; from: number; to: number } | null;
}

/**
 * Usual fingers for a voicing. The index barres when the hand needs it (more than four fretted
 * notes, or three or more notes on the lowest fret with no open string); the other notes take
 * the next fingers by fret, then from the low strings up, leaving room for the notes still to come.
 */
export function fingering(v: Voicing): Fingering {
  const fingers: (number | null)[] = v.frets.map(f => (f === null ? null : f === 0 ? 0 : -1));
  const fretted = v.frets.map((f, s) => ({ f, s })).filter((x): x is { f: number; s: number } => x.f !== null && x.f > 0);
  if (!fretted.length) return { fingers, barre: null };
  const minF = Math.min(...fretted.map(x => x.f));
  const atMin = fretted.filter(x => x.f === minF).map(x => x.s);
  const from = atMin[0], to = atMin[atMin.length - 1];
  const open = v.frets.includes(0);
  const coverable = v.frets.slice(from, to + 1).every(f => f !== 0);
  const barre = coverable && atMin.length >= 2 && (fretted.length > 4 || (!open && atMin.length >= 3)) ? { fret: minF, from, to } : null;

  let rest = fretted;
  let prev = 0;
  if (barre) {
    atMin.forEach(s => (fingers[s] = 1));
    rest = fretted.filter(x => x.f !== minF);
    prev = 1;
  }
  // One finger per group; neighbouring strings on the same fret can share a finger (a small barre)
  // when there are more notes than fingers left — the biggest groups first.
  let groups = rest.map(x => [x]);
  const free = 4 - prev;
  while (groups.length > free) {
    const sorted = [...groups].sort((a, b) => a[0].s - b[0].s);
    let merged = false;
    for (let i = 0; i + 1 < sorted.length && !merged; i++) {
      const a = sorted[i], b = sorted[i + 1];
      if (a[0].f === b[0].f && b[0].s === a[a.length - 1].s + 1) {
        groups = groups.filter(g => g !== a && g !== b).concat([[...a, ...b]]);
        merged = true;
      }
    }
    if (!merged) break;
  }
  groups.sort((a, b) => a[0].f - b[0].f || a[0].s - b[0].s);
  groups.forEach((g, i) => {
    const byFret = g[0].f - minF + 1;
    const room = 4 - (groups.length - 1 - i);
    const f = Math.max(prev + 1, Math.min(byFret, room));
    g.forEach(x => (fingers[x.s] = f));
    prev = f;
  });
  return { fingers, barre };
}

/** True when four fingers are enough. */
export const playable = (v: Voicing) => fingering(v).fingers.every(f => f === null || f <= 4);

/* ---------- Inversions ---------- */

/** Groups of neighbouring strings for inversions (index 0 = low E). */
export const STRING_SETS: { strings: number[]; label: string }[] = [
  { strings: [3, 4, 5], label: 'Sol · Si · Mi' },
  { strings: [2, 3, 4], label: 'Ré · Sol · Si' },
  { strings: [1, 2, 3], label: 'La · Ré · Sol' },
  { strings: [0, 1, 2], label: 'Mi · La · Ré' },
  { strings: [2, 3, 4, 5], label: 'Ré · Sol · Si · Mi' },
  { strings: [1, 2, 3, 4], label: 'La · Ré · Sol · Si' },
  { strings: [0, 1, 2, 3], label: 'Mi · La · Ré · Sol' },
];
export const INV_NAMES = ['État fondamental', '1er renversement', '2e renversement', '3e renversement'];
const INV_MAX_FRET = 14;
const INV_SPAN = 3;

/** String groups that fit the chord: as many strings as it has notes (3 or 4). */
export const setsFor = (type: ChordType) => STRING_SETS.map((x, i) => ({ ...x, i })).filter(x => x.strings.length === type.ivs.length);
export const hasInversions = (type: ChordType) => setsFor(type).length > 0;

/**
 * Close voicings of the chord on one string group: every chord tone once, one per string,
 * within four frets; one per bass note (the lowest on the neck), root position first.
 */
export function inversions(root: number, type: ChordType, set: number): Voicing[] {
  const close = searchInversions(root, type, set, INV_SPAN);
  if (close.length === type.ivs.length) return close;
  // A few four-note chords need one more fret of stretch for some inversions.
  const wide = searchInversions(root, type, set, INV_SPAN + 1);
  return type.ivs.map((_, i) => close.find(v => v.inv === i) ?? wide.find(v => v.inv === i)).filter((v): v is Voicing => !!v);
}

function searchInversions(root: number, type: ChordType, set: number, span: number): Voicing[] {
  const strings = STRING_SETS[set].strings;
  const tones = type.ivs.map(([iv]) => mod12(root + iv));
  if (strings.length !== tones.length) return [];
  const best = new Map<number, Voicing>();
  const walk = (k: number, frets: number[]) => {
    if (k === strings.length) {
      const pcs = frets.map((f, j) => mod12(OPEN_MIDI[strings[j]] + f));
      if (new Set(pcs).size !== tones.length || !tones.every(t => pcs.includes(t))) return;
      const fr = frets.filter(f => f > 0);
      if (fr.length && Math.max(...fr) - Math.min(...fr) > span) return;
      if (!playable({ frets: Array(6).fill(null).map((_, i) => { const j = strings.indexOf(i); return j < 0 ? null : frets[j]; }), base: 1 })) return;
      const inv = tones.indexOf(pcs[0]);
      const all = Array<number | null>(6).fill(null);
      strings.forEach((s, j) => (all[s] = frets[j]));
      const top = fr.length ? Math.max(...fr) : 0;
      const v: Voicing = { inv, set, frets: all, base: top <= 4 ? 1 : Math.min(...fr) };
      const cur = best.get(inv);
      if (!cur || minFret(v) < minFret(cur)) best.set(inv, v);
      return;
    }
    for (let f = 0; f <= INV_MAX_FRET; f++) {
      const pc = mod12(OPEN_MIDI[strings[k]] + f);
      if (tones.includes(pc)) walk(k + 1, [...frets, f]);
    }
  };
  walk(0, []);
  return [...best.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}

/** "C/E" for an inversion, the plain symbol in root position. */
export const slashName = (root: number, type: ChordType, v: Voicing) => {
  const bass = v.frets.findIndex(f => f !== null);
  const pc = mod12(OPEN_MIDI[bass] + (v.frets[bass] ?? 0));
  return chordSymbol(root, type) + (pc === mod12(root) ? '' : '/' + LETTERS[pc]);
};
