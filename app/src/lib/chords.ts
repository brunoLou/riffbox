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
  shape: Shape;
  /** Fret per string, low E to high e; null = not played. */
  frets: (number | null)[];
  /** First fret shown in the diagram (1 = nut). */
  base: number;
}

const MAX_FRET = 15;

/** Every template of the type moved to this root, lowest position first. */
export function voicings(root: number, type: ChordType): Voicing[] {
  const out: Voicing[] = [];
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
    out.push({ shape: tpl.shape, frets, base });
  }
  return out.sort((a, b) => minFret(a) - minFret(b));
}
const minFret = (v: Voicing) => Math.min(...v.frets.filter((f): f is number => f !== null));

/** Sounding MIDI notes of a voicing, low to high. */
export const voicingMidi = (v: Voicing) => v.frets.flatMap((f, s) => (f === null ? [] : [OPEN_MIDI[s] + f]));

/** Interval label of a pitch class in the chord, or null if it is not a chord tone. */
export function intervalOf(root: number, type: ChordType, pc: number): string | null {
  const iv = mod12(pc - root);
  return type.ivs.find(([s]) => s === iv)?.[1] ?? null;
}
