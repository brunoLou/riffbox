/** Scale library: pentatonics, blues, modes, harmonic minor and arpeggios, with their positions. */
import { CHORD_TYPES, LETTERS, voicings, type Shape } from './chords';
import { KEY_FR, STR_PC, mod12 } from './music';

export type ScaleGroup = 'penta' | 'mode' | 'arp';
export interface ScaleDef {
  id: string;
  /** Short label for the chip. */
  chip: string;
  /** Name after the key: "La dorien", "Do penta majeure"… */
  fr: string;
  group: ScaleGroup;
  iv: number[];
  /** Chord type whose CAGED shapes frame the positions (modes and arpeggios). */
  chord: string;
  /** Mode: semitones from its parent major scale's tonic. */
  modeOf?: number;
  /** Pentatonic that can take a blue note. */
  blue?: { iv: number; lab: string };
}

const P_MIN = [0, 3, 5, 7, 10], P_MAJ = [0, 2, 4, 7, 9];

export const SCALE_DEFS: ScaleDef[] = [
  { id: 'pmin', chip: 'Penta min', fr: 'penta mineure', group: 'penta', iv: P_MIN, chord: 'm', blue: { iv: 6, lab: '♭5' } },
  { id: 'pmaj', chip: 'Penta maj', fr: 'penta majeure', group: 'penta', iv: P_MAJ, chord: 'maj', blue: { iv: 3, lab: '♭3' } },
  { id: 'blues', chip: 'Blues', fr: 'gamme blues', group: 'penta', iv: [0, 3, 5, 6, 7, 10], chord: 'm' },
  { id: 'ionien', chip: 'Majeure', fr: 'majeure (ionien)', group: 'mode', iv: [0, 2, 4, 5, 7, 9, 11], chord: 'maj', modeOf: 0 },
  { id: 'dorien', chip: 'Dorien', fr: 'dorien', group: 'mode', iv: [0, 2, 3, 5, 7, 9, 10], chord: 'm', modeOf: 2 },
  { id: 'phrygien', chip: 'Phrygien', fr: 'phrygien', group: 'mode', iv: [0, 1, 3, 5, 7, 8, 10], chord: 'm', modeOf: 4 },
  { id: 'lydien', chip: 'Lydien', fr: 'lydien', group: 'mode', iv: [0, 2, 4, 6, 7, 9, 11], chord: 'maj', modeOf: 5 },
  { id: 'mixo', chip: 'Mixolydien', fr: 'mixolydien', group: 'mode', iv: [0, 2, 4, 5, 7, 9, 10], chord: '7', modeOf: 7 },
  { id: 'eolien', chip: 'Mineure', fr: 'mineure naturelle (éolien)', group: 'mode', iv: [0, 2, 3, 5, 7, 8, 10], chord: 'm', modeOf: 9 },
  { id: 'locrien', chip: 'Locrien', fr: 'locrien', group: 'mode', iv: [0, 1, 3, 5, 6, 8, 10], chord: 'm7b5', modeOf: 11 },
  { id: 'harm', chip: 'Harmonique', fr: 'mineure harmonique', group: 'mode', iv: [0, 2, 3, 5, 7, 8, 11], chord: 'm' },
  { id: 'arp-maj', chip: 'Arp. maj', fr: 'arpège majeur', group: 'arp', iv: [0, 4, 7], chord: 'maj' },
  { id: 'arp-m', chip: 'Arp. m', fr: 'arpège mineur', group: 'arp', iv: [0, 3, 7], chord: 'm' },
  { id: 'arp-7', chip: 'Arp. 7', fr: 'arpège 7', group: 'arp', iv: [0, 4, 7, 10], chord: '7' },
  { id: 'arp-m7', chip: 'Arp. m7', fr: 'arpège m7', group: 'arp', iv: [0, 3, 7, 10], chord: 'm7' },
  { id: 'arp-maj7', chip: 'Arp. maj7', fr: 'arpège maj7', group: 'arp', iv: [0, 4, 7, 11], chord: 'maj7' },
];
export const scaleDef = (id: string) => SCALE_DEFS.find(s => s.id === id) ?? SCALE_DEFS[0];

const LAB = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];
/** Interval label in this scale (the lydian fourth is ♯4, not ♭5). */
export const ivLabel = (def: ScaleDef, iv: number) => (iv === 6 && def.id === 'lydien' ? '♯4' : LAB[iv]);

/** One-line reminder of what the scale is related to. */
export function relatedLine(def: ScaleDef, key: number): string {
  switch (def.id) {
    case 'pmin': return `mêmes notes que ${KEY_FR[mod12(key + 3)]} penta majeure`;
    case 'pmaj': return `mêmes notes que ${KEY_FR[mod12(key + 9)]} penta mineure`;
    case 'blues': return 'la penta mineure avec la note bleue (♭5)';
    case 'ionien': return `mêmes notes que ${KEY_FR[mod12(key + 9)]} mineur`;
    case 'harm': return 'la mineure naturelle avec une 7 majeure';
  }
  if (def.group === 'arp') {
    const t = CHORD_TYPES.find(c => c.id === def.chord)!;
    return `les notes de l’accord ${LETTERS[key] + t.sym}`;
  }
  return `mêmes notes que ${KEY_FR[mod12(key - (def.modeOf ?? 0))]} majeur`;
}

/** Fret range per string (index 0 = low E) for one position. */
export type Box = Record<number, [number, number]>;
export interface Position { label: string; box: Box; shape?: Shape }

const LAST = 17;

/** Pentatonic boxes 1–5: two notes per string from the N-th degree on the low E (blues uses the minor penta's). */
function pentaBoxes(def: ScaleDef, key: number): Position[] {
  const iv = def.id === 'blues' ? P_MIN : def.iv;
  const r0 = mod12(key - 4);
  return iv.map((d, n) => {
    const start = r0 + d - 1;
    let pts: [number, number][] = [];
    STR_PC.forEach((sp, si) => {
      let k = 0;
      for (let f = Math.max(0, start); f < start + 8 && k < 2; f++) if (iv.includes(mod12(sp + f - key))) { pts.push([si, f]); k++; }
    });
    // A box running off the end of the neck is folded down an octave.
    if (Math.max(...pts.map(p => p[1])) > LAST && Math.min(...pts.map(p => p[1])) >= 12) pts = pts.map(([s, f]) => [s, f - 12]);
    const box: Box = {};
    for (const [si, f] of pts) { const b = box[si] || (box[si] = [99, -1]); b[0] = Math.min(b[0], f); b[1] = Math.max(b[1], f); }
    // The blue note sits between two box notes: widen each string's range so it shows when it falls just outside.
    if (def.id === 'blues') for (const si of Object.keys(box).map(Number)) {
      const b = box[si];
      for (const f of [b[0] - 1, b[1] + 1]) if (f >= 0 && mod12(STR_PC[si] + f - key) === 6) { b[0] = Math.min(b[0], f); b[1] = Math.max(b[1], f); }
    }
    return { label: String(n + 1), box };
  });
}

/** CAGED positions: each shape of the tonic chord, widened by a fret on each side. */
function cagedBoxes(def: ScaleDef, key: number): Position[] {
  const type = CHORD_TYPES.find(c => c.id === def.chord)!;
  return voicings(key, type).map(v => {
    const fr = v.frets.filter((f): f is number => f !== null);
    const lo = Math.max(0, Math.min(...fr) - 1), hi = Math.min(LAST, Math.max(...fr) + 1);
    const box: Box = {};
    for (let si = 0; si < 6; si++) box[si] = [lo, hi];
    return { label: v.shape, box, shape: v.shape };
  });
}

export const positions = (def: ScaleDef, key: number): Position[] =>
  def.group === 'penta' ? pentaBoxes(def, key) : cagedBoxes(def, key);

/** One octave up and back down from a comfortable root, for listening. */
export function listenNotes(def: ScaleDef, key: number, blue: boolean): number[] {
  const root = 48 + mod12(key - 0); // C3–B3
  const ivs = [...new Set([...def.iv, ...(blue && def.blue ? [def.blue.iv] : [])])].sort((a, b) => a - b);
  const up = [...ivs.map(i => root + i), root + 12];
  return [...up, ...up.slice(0, -1).reverse()];
}
