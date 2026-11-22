/**
 * « Nouvelle grille… »: a whole chord grid from a key, a style and a structure. Progressions are
 * drawn from typical patterns of each style, then varied (substitutions, colours) so that the same
 * four chords do not come back every time. Pure logic, with an injectable random source.
 */
import type { GridGroove } from './grids';
import { mod12, sameChord, type Chord } from './music';

export type GenStyle = 'pop' | 'folk' | 'blues' | 'rock' | 'ballade' | 'funk' | 'jazz' | 'chanson';
export type Role = 'verse' | 'chorus' | 'bridge';

export interface StyleDef {
  id: GenStyle; label: string; groove: GridGroove; bpm: [number, number];
  /** Progression patterns per section, in degrees of the major key (lower case: minor). */
  verse: string[]; chorus: string[]; bridge: string[];
  /** Chance of each variation being applied to a chord. */
  vary: number;
  /** The melody revolves around the relative minor (vi) rather than the major tonic. */
  minorFeel?: boolean;
}

export const STYLES: StyleDef[] = [
  { id: 'pop', label: 'Pop', groove: 'rock', bpm: [96, 124], vary: 0.2,
    verse: ['I V vi IV', 'vi IV I V', 'I iii IV V', 'I vi ii V', 'I V IV V', 'vi V IV V'],
    chorus: ['IV V I vi', 'IV I V vi', 'vi IV I V', 'I V vi IV', 'IV V iii vi', 'ii IV I V'],
    bridge: ['ii IV vi V', 'IV iv I V', 'vi iii IV V', 'bVI bVII I I', 'ii iii IV V'] },
  { id: 'folk', label: 'Folk', groove: 'shuffle', bpm: [80, 108], vary: 0.15,
    verse: ['I IV I V', 'I V IV I', 'I I IV I', 'vi IV I V', 'I IV vi V'],
    chorus: ['IV I V I', 'IV V I I', 'vi IV I V', 'IV I IV V', 'I IV V IV'],
    bridge: ['vi V IV V', 'ii V I vi', 'IV V vi vi', 'vi IV V V'] },
  { id: 'blues', label: 'Blues 8 mesures', groove: 'shuffle', bpm: [72, 112], vary: 0.1,
    verse: ['I7 IV7 I7 V7', 'I7 I7 IV7 I7', 'I7 V7 IV7 I7'],
    chorus: ['IV7 IV7 I7 I7', 'V7 IV7 I7 V7', 'IV7 IV7 I7 V7'],
    bridge: ['IV7 IV7 I7 I7', 'VI7 II7 V7 V7', 'IV7 iv I7 V7'] },
  { id: 'rock', label: 'Rock', groove: 'rock', bpm: [112, 148], vary: 0.2,
    verse: ['I bVII IV I', 'I IV bVII IV', 'vi IV V V', 'I bIII IV I', 'I V bVII IV'],
    chorus: ['IV V I I', 'I V IV IV', 'bVI bVII I I', 'IV I V V', 'I bVII IV V'],
    bridge: ['vi V IV IV', 'bVI bVII I V', 'ii IV V V', 'IV IV V V'] },
  { id: 'ballade', label: 'Ballade', groove: 'rock', bpm: [64, 84], vary: 0.25,
    verse: ['I iii vi IV', 'I V vi iii', 'I vi IV V', 'vi IV I V', 'I IV iii vi'],
    chorus: ['IV V iii vi', 'IV I V vi', 'ii V I vi', 'IV iv I vi', 'vi IV I V'],
    bridge: ['ii iii IV V', 'bVI IV I V', 'iii vi ii V', 'IV iv iii vi'] },
  { id: 'funk', label: 'Funk', groove: 'funk', bpm: [92, 112], vary: 0.1,
    verse: ['ii7 V7 ii7 V7', 'vi7 vi7 II7 II7', 'I7 I7 IV7 IV7', 'ii7 ii7 V7 V7'],
    chorus: ['IV7 IV7 I7 I7', 'IV7 V7 vi7 vi7', 'ii7 V7 I7 I7', 'IV7 IV7 V7 V7'],
    bridge: ['bVII7 bVII7 IV7 IV7', 'iii7 vi7 ii7 V7', 'IV7 bVII7 I7 I7'] },
  { id: 'jazz', label: 'Jazz simple', groove: 'shuffle', bpm: [96, 140], vary: 0.15,
    verse: ['ii7 V7 I I', 'I vi7 ii7 V7', 'iii7 vi7 ii7 V7', 'I VI7 ii7 V7'],
    chorus: ['IV7 iv I VI7', 'ii7 V7 iii7 VI7', 'I I7 IV iv', 'ii7 V7 I vi7'],
    bridge: ['III7 III7 VI7 VI7', 'II7 II7 ii7 V7', 'iii7 VI7 ii7 V7'] },
  { id: 'chanson', label: 'Chanson française', groove: 'shuffle', bpm: [84, 112], vary: 0.2, minorFeel: true,
    verse: ['vi ii V I', 'vi iii IV I', 'vi ii III7 vi', 'I vi ii V', 'vi IV ii III7'],
    chorus: ['IV V iii vi', 'ii V I vi', 'IV I ii III7', 'IV V I vi', 'vi ii V I'],
    bridge: ['IV iv I vi', 'ii III7 vi vi', 'bVI bVII I I', 'IV V III7 vi'] },
];
export const styleDef = (id: GenStyle) => STYLES.find(s => s.id === id)!;

const ROMAN: Record<string, number> = { I: 0, bII: 1, II: 2, bIII: 3, III: 4, IV: 5, '#IV': 6, V: 7, bVI: 8, VI: 9, bVII: 10, VII: 11 };
/** "ii7" → the chord on the 2nd degree, minor seventh, in `key`. */
export function degreeChord(key: number, token: string): Chord {
  const m = token.match(/^(b|#)?([ivIV]+)(7|sus4)?$/);
  if (!m) throw new Error(`degré inconnu : ${token}`);
  const minor = m[2] === m[2].toLowerCase();
  const pc = mod12(key + ROMAN[(m[1] ?? '') + m[2].toUpperCase()]);
  return { pc, ...(minor ? { m: true } : {}), ...(m[3] ? { x: m[3] as Chord['x'] } : {}) };
}

export type Rng = () => number;
/** A small seeded random source (mulberry32), so that a grid can be generated again. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(a: T[], rng: Rng) => a[Math.floor(rng() * a.length)];

/** Variations on a chord that keep the progression's sense. */
function vary(key: number, c: Chord, i: number, len: number, rng: Rng, p: number): Chord {
  if (rng() >= p) return c;
  const d = mod12(c.pc - key);
  const isV = d === 7 && !c.m && !c.x;
  if (isV) return i === len - 1 ? { ...c, x: 'sus4' } : { ...c, x: '7' }; // a suspension to end, else the 7th
  if (d === 5 && !c.m && !c.x && i > 0) return { pc: mod12(key + 2), m: true }; // IV → ii
  if (d === 0 && !c.m && !c.x && i > 0) return { pc: mod12(key + 9), m: true }; // I → vi
  if (d === 9 && c.m && !c.x) return { ...c, x: '7' }; // vi → vi7
  return c;
}

/** One section of `len` bars (4 or 8). An 8-bar section is two phrases, the second one ending its own way. */
export function generateSection(key: number, style: GenStyle, role: Role, len: number, rng: Rng): Chord[] {
  const def = styleDef(style);
  const phrase = () => pick(def[role], rng).split(' ').map(t => degreeChord(key, t));
  let out = phrase();
  if (len > 4) {
    let second = phrase();
    // A different second phrase when the style has one to offer.
    for (let k = 0; k < 4 && second.every((c, i) => sameChord(c, out[i])); k++) second = phrase();
    out = [...out, ...second];
  }
  return out.map((c, i) => vary(key, c, i, out.length, rng, def.vary));
}

export interface GenOptions { key: number; style: GenStyle; bars: 4 | 8; bridge: boolean }

/**
 * A whole grid: verse, chorus and (optionally) bridge. The chorus contrasts with the verse: it does
 * not start on the same chord, nor repeat the verse.
 */
export function generateGrid(o: GenOptions, rng: Rng): Chord[][] {
  const verse = generateSection(o.key, o.style, 'verse', o.bars, rng);
  let chorus = generateSection(o.key, o.style, 'chorus', o.bars, rng);
  for (let k = 0; k < 12 && sameChord(chorus[0], verse[0]); k++) chorus = generateSection(o.key, o.style, 'chorus', o.bars, rng);
  if (sameChord(chorus[0], verse[0])) chorus = [degreeChord(o.key, 'IV'), ...chorus.slice(1)];
  let bridge: Chord[] = [];
  if (o.bridge) {
    bridge = generateSection(o.key, o.style, 'bridge', 4, rng);
    for (let k = 0; k < 12 && (sameChord(bridge[0], chorus[0]) || sameChord(bridge[0], verse[0])); k++) bridge = generateSection(o.key, o.style, 'bridge', 4, rng);
  }
  return [verse, chorus, bridge];
}

/**
 * « Une autre »: a new version of one section, keeping the chords the player locked where they are.
 * It differs from the current one whenever the style allows it.
 */
export function regenerateSection(key: number, style: GenStyle, role: Role, current: Chord[], rng: Rng): Chord[] {
  if (!current.length) return generateSection(key, style, role, 4, rng);
  const len = current.length > 4 ? 8 : 4;
  const fit = (s: Chord[]) => current.map((c, i) => (c.lock ? c : s[i] ?? c));
  let best = fit(generateSection(key, style, role, len, rng));
  for (let k = 0; k < 16 && best.every((c, i) => sameChord(c, current[i])); k++) best = fit(generateSection(key, style, role, len, rng));
  return best;
}

export const ROLES: Role[] = ['verse', 'chorus', 'bridge'];

/* ---------- Key for the singer's voice ---------- */

/** A typical song melody, in semitones from its tonic: from the fifth below to the sixth above. */
export const MELODY_SPAN = { lo: -5, hi: 9 };
/** Keys that are easy on the guitar (open chords), as the melody's tonic: major, then minor. */
const EASY_MAJOR = [0, 7, 2, 9, 4];
const EASY_MINOR = [9, 4, 2, 11];

/**
 * The grid key that puts a typical melody of `style` in the voice `low`–`high` (MIDI): centred,
 * a little low for comfort (as for the vocal exercises). When a guitar-friendly key is a semitone
 * away and still fits, it is preferred.
 */
export function keyForVoice(low: number, high: number, style: GenStyle): { key: number; tonic: number; melodyLow: number; melodyHigh: number } {
  const { lo, hi } = MELODY_SPAN;
  const room = high - low - (hi - lo);
  let tonic = low - lo + Math.max(0, Math.floor(room * 0.4));
  const minor = !!styleDef(style).minorFeel;
  const easy = minor ? EASY_MINOR : EASY_MAJOR;
  if (!easy.includes(mod12(tonic))) {
    const fits = (t: number) => t + lo >= low && t + hi <= high;
    const alt = [tonic + 1, tonic - 1].find(t => easy.includes(mod12(t)) && fits(t));
    if (alt !== undefined) tonic = alt;
  }
  return { key: minor ? mod12(tonic + 3) : mod12(tonic), tonic, melodyLow: tonic + lo, melodyHigh: tonic + hi };
}
