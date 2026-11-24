/**
 * The piano side of a chord: how a pianist plays it, the exact notes of a guitar position laid on
 * the keyboard, and the other way round, which chord a few keys make.
 */
import { CHORD_TYPES, chordSymbol, LETTERS, voicingMidi, type ChordType, type Voicing } from './chords';
import { mod12 } from './music';

/** White keys of an octave (pitch classes) and whether a pitch is on a black key. */
export const isBlack = (midi: number) => [1, 3, 6, 8, 10].includes(mod12(midi));

/**
 * The chord as a pianist plays it: the root alone in the left hand (octave of C3), the chord in
 * close position in the right hand from the root above middle C (ninths an octave up).
 */
export function pianoVoicing(root: number, type: ChordType): number[] {
  const lh = 48 + mod12(root);
  const base = 60 + mod12(root);
  const rh = type.ivs.map(([s, lab]) => base + s + (lab.includes('9') ? 12 : 0)).sort((a, b) => a - b);
  return [lh, ...rh];
}

/** The guitar position's sounding notes (low to high), as they fall on the keyboard. */
export const guitarNotes = (v: Voicing) => voicingMidi(v).sort((a, b) => a - b);

/** Keyboard range to show these notes: from the C below the lowest to the B above the highest (two octaves at least). */
export function keyRange(notes: number[]): [number, number] {
  if (!notes.length) return [48, 71];
  const lo = Math.floor(Math.min(...notes) / 12) * 12;
  let hi = Math.floor(Math.max(...notes) / 12) * 12 + 11;
  if (hi - lo < 23) hi = lo + 23;
  return [lo, hi];
}

export interface Named { root: number; type: ChordType; bass: number; name: string; exact: boolean }

/**
 * The chords these notes make, the most likely first: every note belongs to the chord and every
 * note it needs is there (its optional fifth may be left out). The bass note as root first, else a
 * slash chord (« C/E »).
 */
export function nameChord(midis: number[]): Named[] {
  if (!midis.length) return [];
  const pcs = [...new Set(midis.map(mod12))];
  const bass = mod12(Math.min(...midis));
  const out: (Named & { score: number })[] = [];
  for (let root = 0; root < 12; root++) {
    CHORD_TYPES.forEach((type, order) => {
      const tones = type.ivs.map(([s]) => mod12(root + s));
      const needed = type.ivs.filter(([s]) => !type.optional?.includes(s)).map(([s]) => mod12(root + s));
      if (!pcs.every(p => tones.includes(p)) || !needed.every(p => pcs.includes(p))) return;
      const exact = tones.length === pcs.length;
      const name = chordSymbol(root, type) + (bass !== root ? `/${LETTERS[bass]}` : '');
      // Root in the bass, every tone present, then the simplest chord.
      const score = (bass === root ? 0 : 100) + (exact ? 0 : 10) + order * 0.1;
      out.push({ root, type, bass, name, exact, score });
    });
  }
  return out.sort((a, b) => a.score - b.score).map(({ score: _s, ...n }) => n);
}

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ORDER = 'CDEFGAB';
/**
 * Each note of the chord written as in the chord (« G# » in E major, « Bb » in C7): the letter
 * follows the interval's number, the accidental makes up the difference.
 */
export function chordSpelling(root: number, type: ChordType): Record<number, string> {
  const rootName = LETTERS[mod12(root)];
  const li = ORDER.indexOf(rootName[0]);
  const out: Record<number, string> = {};
  for (const [s, lab] of type.ivs) {
    const deg = Number(lab.replace(/[^0-9]/g, '')) || 1;
    const letter = ORDER[(li + deg - 1) % 7];
    const pc = mod12(root + s);
    let d = mod12(pc - LETTER_PC[letter]);
    if (d > 6) d -= 12;
    out[pc] = letter + (d > 0 ? '#'.repeat(d) : 'b'.repeat(-d));
  }
  return out;
}
