export const mod12 = (n: number) => ((n % 12) + 12) % 12;

export const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FR = ['Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
export const KEY_FR = ['Do', 'Do♯', 'Ré', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
/** Transpose a chord symbol like "F#m7" by n semitones. */
export function transposeChord(ch: string, n: number): string {
  if (!n) return ch;
  const m = ch.match(/^([A-G])([#b]?)(.*)$/);
  if (!m) return ch;
  const i = LETTER[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + n;
  // Keep the spelling style of the original chord (flats stay flats).
  return (m[2] === 'b' ? FLAT : SHARP)[mod12(i)] + m[3];
}

/* ---------- ChordPro ---------- */

export interface Seg { chord: string; text: string }
export type SongLine = { kind: 'section'; label: string } | { kind: 'line'; segs: Seg[] };

export function parseChordPro(src: string, n: number): SongLine[] {
  return src.split('\n').map((line): SongLine => {
    const c = line.match(/^\{c:(.*)\}$/);
    if (c) return { kind: 'section', label: c[1] };
    const parts = line.split(/\[([^\]]+)\]/);
    const segs: Seg[] = [];
    if (parts[0]) segs.push({ chord: ' ', text: parts[0] });
    for (let i = 1; i < parts.length; i += 2) {
      const t = parts[i + 1] || '';
      segs.push({ chord: transposeChord(parts[i], n) + (t.length < 4 ? '  ' : ' '), text: t || ' ' });
    }
    return { kind: 'line', segs };
  });
}

/* ---------- Circle of fifths ---------- */

/** Pitch classes of the outer (major) ring, clockwise from the top. */
export const OUT_PC = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
export const OUT_N = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
export const IN_N = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm'];
export const PC_IDX: Record<number, number> = {};
OUT_PC.forEach((p, i) => (PC_IDX[p] = i));
/** Minor keys as spelled on the wheel's inner ring (C♯ m, not D♭ m). */
export const MINOR_FR: Record<number, string> = {
  9: 'La', 4: 'Mi', 11: 'Si', 6: 'Fa♯', 1: 'Do♯', 8: 'Sol♯', 3: 'Ré♯', 10: 'Si♭', 5: 'Fa', 0: 'Do', 7: 'Sol', 2: 'Ré',
};
/** French key names as spelled on the wheel. */
export const KFR: Record<number, string> = {
  0: 'Do', 7: 'Sol', 2: 'Ré', 9: 'La', 4: 'Mi', 11: 'Si', 6: 'Fa♯', 1: 'Ré♭', 8: 'La♭', 3: 'Mi♭', 10: 'Si♭', 5: 'Fa',
};

/** A grid chord: root pitch class, minor or major, and an optional colour (7th: dominant 7, or m7 when minor; sus4). */
export interface Chord {
  pc: number; m?: boolean; x?: '7' | 'sus4';
  /** Kept in place when a generated section is made again (« Une autre »). */
  lock?: boolean;
}

export const chordName = (c: Chord) => {
  if (c.x === 'sus4') return OUT_N[PC_IDX[c.pc]] + 'sus4';
  const i = PC_IDX[c.m ? mod12(c.pc + 3) : c.pc];
  return (c.m ? IN_N[i] : OUT_N[i]) + (c.x === '7' ? '7' : '');
};
export const sameChord = (a: Chord, b: Chord) => a.pc === b.pc && !!a.m === !!b.m && a.x === b.x;

/** Roman-numeral degree of a diatonic triad in a major key, or '' if outside. */
export function degreeOf(key: number, pc: number, minor?: boolean): string {
  const d = mod12(pc - key);
  const maj: Record<number, string> = { 0: 'I', 5: 'IV', 7: 'V' };
  const min: Record<number, string> = { 2: 'ii', 4: 'iii', 9: 'vi' };
  return (minor ? min[d] : maj[d]) || '';
}

/* ---------- Scales / fretboard ---------- */

/** Open-string pitch classes, low E (index 0) to high e (index 5). */
export const STR_PC = [4, 9, 2, 7, 11, 4];
export const NOTE_L = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
/** Key chips order on the Gammes screen (starts on La). */
export const KEY_ORDER = [9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8];


/** The chord's type id, as named by the chord library and the backing tracks (maj, m, 7, m7, sus4). */
export const chordTypeId = (c: Chord): 'maj' | 'm' | '7' | 'm7' | 'sus4' =>
  c.x === 'sus4' ? 'sus4' : c.x === '7' ? (c.m ? 'm7' : '7') : c.m ? 'm' : 'maj';
