/**
 * Chord recognition from the microphone, for the stage prompter's « Suivre ma guitare ».
 * The spectrum is folded into 12 pitch classes (a chroma vector), then compared with the chords
 * the song actually uses: recognising one chord among five or six is far more reliable than
 * naming any chord from scratch.
 */
import { CHORD_TYPES, chordType, type ChordType } from './chords';
import { mod12 } from './music';

const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11, H: 11 };

export interface ChordShape { name: string; root: number; pcs: number[]; bass: number; type: ChordType }

/** "A7", "F#m", "Bbmaj7", "C/G", "Dsus4", "E7#9" → root, pitch classes and bass. Null if not a chord. */
export function parseChordName(name: string): ChordShape | null {
  const m = name.trim().match(/^([A-H])([#♯b♭]?)([^/]*)(?:\/([A-H])([#♯b♭]?))?$/);
  if (!m) return null;
  const acc = (a: string) => (a === '#' || a === '♯' ? 1 : a === 'b' || a === '♭' ? -1 : 0);
  const root = mod12(LETTER[m[1]] + acc(m[2]));
  const rest = m[3].replace(/[()]/g, '');
  // The longest chord symbol the rest starts with ("m7♭5" before "m7" before "m").
  const norm = (s: string) => s.replace('♭', 'b').replace('♯', '#');
  const types = [...CHORD_TYPES].sort((a, b) => b.sym.length - a.sym.length);
  const type = types.find(t => norm(rest).startsWith(norm(t.sym))) ?? CHORD_TYPES[0];
  // "Amin" and "A-" are other ways to write A minor.
  const minor = /^(min|-)/.test(rest);
  const ivs = minor ? [0, 3, 7] : type.ivs.map(([s]) => s);
  const pcs = [...new Set(ivs.map(i => mod12(root + i)))];
  const bass = m[4] ? mod12(LETTER[m[4]] + acc(m[5])) : root;
  if (!pcs.includes(bass)) pcs.push(bass);
  return { name: name.trim(), root, pcs, bass, type: minor ? chordType('m') : type };
}

/**
 * Chroma vector (12 values summing to 1) from a magnitude spectrum: only spectral peaks between
 * 70 Hz and 2 kHz count, each folded onto its nearest pitch class. Also returns the bass note.
 */
export function chroma(mags: ArrayLike<number>, sampleRate: number, fftSize: number): { c: number[]; bass: number | null; energy: number } {
  const c = new Array(12).fill(0);
  const hz = sampleRate / fftSize;
  const lo = Math.ceil(70 / hz), hi = Math.min(mags.length - 2, Math.floor(2000 / hz));
  const low: { f: number; v: number; pc: number }[] = [];
  let energy = 0;
  for (let i = Math.max(lo, 1); i <= hi; i++) {
    const v = mags[i];
    if (v <= mags[i - 1] || v < mags[i + 1]) continue; // peaks only: no leakage between notes
    // Parabolic interpolation gives the true frequency between two bins.
    const a = mags[i - 1], b = mags[i + 1];
    const d = (a - 2 * v + b) === 0 ? 0 : (0.5 * (a - b)) / (a - 2 * v + b);
    const f = (i + d) * hz;
    const midi = 69 + 12 * Math.log2(f / 440);
    const near = Math.round(midi);
    // A tuned string is within 20 cents of its note; the 7th and 11th harmonics are not
    // (a third of a semitone flat), so they do not pass for chord tones.
    if (Math.abs(midi - near) > 0.2) continue;
    const w = v * v;
    c[mod12(near)] += w;
    energy += w;
    if (f < 220) low.push({ f, v, pc: mod12(near) });
  }
  // Bass: the lowest clear note (not merely the loudest low one), as the bass string sounds.
  const top = Math.max(0, ...low.map(x => x.v));
  const bassPeak = low.filter(x => x.v >= top * 0.35).sort((x, y) => x.f - y.f)[0];
  const sum = c.reduce((s, x) => s + x, 0);
  return { c: sum ? c.map(x => x / sum) : c, bass: bassPeak ? bassPeak.pc : null, energy };
}

/** How well a chroma matches each candidate chord (about 0 to 1.1), best first. */
export function rankChords(ch: { c: number[]; bass: number | null }, candidates: ChordShape[]) {
  const norm = Math.sqrt(ch.c.reduce((s, x) => s + x * x, 0)) || 1;
  return candidates.map(shape => {
    // Template: chord tones, the root a little stronger.
    const t = new Array(12).fill(0);
    shape.pcs.forEach(pc => (t[pc] = 1));
    t[shape.root] = 1.4;
    const tn = Math.sqrt(t.reduce((s, x) => s + x * x, 0));
    let score = ch.c.reduce((s, x, i) => s + x * t[i], 0) / (norm * tn);
    // The bass string usually plays the root (or the written bass): a strong hint.
    if (ch.bass !== null) score += ch.bass === shape.bass ? 0.12 : shape.pcs.includes(ch.bass) ? 0 : -0.08;
    // Not capped: a capped score would tie a triad with its seventh chord when both reach 1.
    return { name: shape.name, score };
  }).sort((a, b) => b.score - a.score);
}

/** The distinct chords of a ChordPro text, in order of appearance. */
export function songChords(chordpro: string): ChordShape[] {
  const seen = new Map<string, ChordShape>();
  for (const m of chordpro.matchAll(/\[([^\]]+)\]/g)) {
    const shape = parseChordName(m[1]);
    if (shape && !seen.has(shape.name)) seen.set(shape.name, shape);
  }
  return [...seen.values()];
}
