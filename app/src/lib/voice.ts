/** Vocal pitch training: note names, exercises, melodies, timelines and scoring. */
import { readStored } from './store';

/* ---------- Notes ---------- */

const FR_NAMES = ['Do', 'Do♯', 'Ré', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
const SCI_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const pc = (m: number) => ((Math.round(m) % 12) + 12) % 12;

/** French solfège name with French octave numbering (La3 = 440 Hz). */
export const noteFr = (m: number) => `${FR_NAMES[pc(m)]}${Math.floor(Math.round(m) / 12) - 2}`;
/** Scientific name (A4 = 440 Hz). */
export const noteSci = (m: number) => `${SCI_NAMES[pc(m)]}${Math.floor(Math.round(m) / 12) - 1}`;
export const isNatural = (m: number) => [0, 2, 4, 5, 7, 9, 11].includes(pc(m));

/** Bring `m` to the octave closest to `ref` (singing an octave off still counts). */
export const foldTo = (m: number, ref: number) => m - 12 * Math.round((m - ref) / 12);

/* ---------- Tolerance and colours ---------- */

export type Accuracy = 'good' | 'close' | 'off';
export const accuracy = (cents: number, tol: number): Accuracy =>
  Math.abs(cents) <= tol ? 'good' : Math.abs(cents) <= tol * 2 ? 'close' : 'off';
export const ACC_COLOR: Record<Accuracy, string> = { good: '#62d98a', close: '#e9a23b', off: '#e0603a' };
export const TOL = { key: 'voice.tol', def: 25, min: 5, max: 50, step: 5 };

/* ---------- Range (tessiture) ---------- */

export interface VoiceRange { low: number; high: number; measured: boolean }
/** Until measured: a middle range (C3–G4); scoring folds octaves so any voice works. */
export const DEFAULT_RANGE: VoiceRange = { low: 48, high: 67, measured: false };
export const readRange = () => readStored<VoiceRange>('voice.range', DEFAULT_RANGE);

export function voiceType(r: VoiceRange): string {
  const mid = (r.low + r.high) / 2;
  if (mid < 52) return 'Basse';
  if (mid < 56) return 'Baryton';
  if (mid < 60) return 'Ténor';
  if (mid < 64) return 'Alto';
  if (mid < 68) return 'Mezzo-soprano';
  return 'Soprano';
}

/* ---------- Exercises and melodies ---------- */

/** One step: semitones from the tonic (null = rest), length in beats, optional glide target and syllable. */
export interface Step { s: number | null; beats: number; to?: number; syl?: string }
export interface Piece {
  id: string; kind: 'warmup' | 'melody'; title: string; sub: string; bpm: number;
  /** Phrases of steps; warm-ups are repeated a semitone higher each time (`reps`). */
  phrases: { label: string; steps: Step[] }[];
  reps?: number;
}

const up = (ivs: number[], beats = 1, last = 2): Step[] => ivs.map((s, i) => ({ s, beats: i === ivs.length - 1 ? last : beats }));

export const WARMUPS: Piece[] = [
  { id: 'sirene', kind: 'warmup', title: 'Sirène', sub: 'Glisser du grave à l’aigu, sur « ou »', bpm: 60, reps: 2,
    phrases: [{ label: 'Sirène', steps: [{ s: 0, beats: 4, to: 12 }, { s: 12, beats: 4, to: 0 }] }] },
  { id: 'gamme5', kind: 'warmup', title: 'Gamme 5 notes', sub: 'Do ré mi fa sol fa mi ré do', bpm: 92, reps: 3,
    phrases: [{ label: 'Gamme', steps: up([0, 2, 4, 5, 7, 5, 4, 2, 0]) }] },
  { id: 'gamme8', kind: 'warmup', title: 'Gamme complète', sub: 'Une octave, montée et descente', bpm: 100, reps: 2,
    phrases: [{ label: 'Gamme', steps: up([0, 2, 4, 5, 7, 9, 11, 12, 11, 9, 7, 5, 4, 2, 0]) }] },
  { id: 'arpege', kind: 'warmup', title: 'Arpège majeur', sub: 'Do mi sol do sol mi do', bpm: 84, reps: 3,
    phrases: [{ label: 'Arpège', steps: up([0, 4, 7, 12, 7, 4, 0]) }] },
  { id: 'tierces', kind: 'warmup', title: 'Tierces', sub: 'Intervalle de tierce majeure', bpm: 72, reps: 3,
    phrases: [{ label: 'Tierce', steps: up([0, 4, 0], 2, 2) }] },
  { id: 'quintes', kind: 'warmup', title: 'Quintes', sub: 'Intervalle de quinte juste', bpm: 72, reps: 3,
    phrases: [{ label: 'Quinte', steps: up([0, 7, 0], 2, 2) }] },
  { id: 'octave', kind: 'warmup', title: 'Octave', sub: 'Sauter d’une octave et revenir', bpm: 66, reps: 2,
    phrases: [{ label: 'Octave', steps: up([0, 12, 0], 2, 2) }] },
];

const n = (s: number, beats: number, syl: string): Step => ({ s, beats, syl });

export const MELODIES: Piece[] = [
  { id: 'clair-lune', kind: 'melody', title: 'Au clair de la lune', sub: 'Traditionnel · 6 phrases', bpm: 96, phrases: [
    { label: 'Au clair de la lune', steps: [n(0, 1, 'Au'), n(0, 1, 'clair'), n(0, 1, 'de'), n(2, 1, 'la'), n(4, 2, 'lu'), n(2, 2, 'ne')] },
    { label: 'mon ami Pierrot', steps: [n(0, 1, 'mon'), n(4, 1, 'a'), n(2, 1, 'mi'), n(2, 1, 'Pier'), n(0, 4, 'rot')] },
    { label: 'Ma chandelle est morte', steps: [n(2, 1, 'Ma'), n(2, 1, 'chan'), n(2, 1, 'del'), n(2, 1, 'le est'), n(-3, 2, 'mor'), n(-3, 2, 'te')] },
    { label: 'je n’ai plus de feu', steps: [n(2, 1, 'je'), n(0, 1, 'n’ai'), n(-1, 1, 'plus'), n(-3, 1, 'de'), n(-5, 4, 'feu')] },
    { label: 'Ouvre-moi ta porte', steps: [n(0, 1, 'Ou'), n(0, 1, 'vre'), n(0, 1, 'moi'), n(2, 1, 'ta'), n(4, 2, 'por'), n(2, 2, 'te')] },
    { label: 'pour l’amour de Dieu', steps: [n(0, 1, 'pour'), n(4, 1, 'l’a'), n(2, 1, 'mour'), n(2, 1, 'de'), n(0, 4, 'Dieu')] },
  ] },
  { id: 'minuit', kind: 'melody', title: 'Minuit Shuffle · refrain', sub: 'Mélodie originale · 4 phrases', bpm: 92, phrases: [
    { label: 'Minuit shuffle', steps: [n(0, 1, 'Mi'), n(3, 1, 'nuit'), n(5, 1, 'shuf'), n(3, 1, 'fle')] },
    { label: 'minuit shuffle', steps: [n(0, 1, 'mi'), n(3, 1, 'nuit'), n(7, 1, 'shuf'), n(5, 2, 'fle')] },
    { label: 'Les néons tremblent', steps: [n(7, 0.5, 'Les'), n(7, 0.5, 'né'), n(5, 1, 'ons'), n(3, 1, 'trem'), n(5, 2, 'blent')] },
    { label: 'au bord du quai', steps: [n(3, 0.5, 'au'), n(0, 1.5, 'bord'), n(-2, 1, 'du'), n(0, 3, 'quai')] },
  ] },
];

export const pieceById = (id: string) => [...WARMUPS, ...MELODIES].find(p => p.id === id);

/** Lowest and highest semitone used by a piece, relative to its tonic. */
function span(p: Piece) {
  const all = p.phrases.flatMap(ph => ph.steps.flatMap(st => (st.s === null ? [] : [st.s, st.to ?? st.s])));
  return { lo: Math.min(...all), hi: Math.max(...all) + (p.reps ? p.reps - 1 : 0) };
}

/** Tonic (MIDI) that places the piece in the singer's range: centred, a little low for comfort. */
export function tonicFor(p: Piece, r: VoiceRange) {
  const { lo, hi } = span(p);
  const room = r.high - r.low - (hi - lo);
  const start = r.low - lo + Math.max(0, Math.floor(room * 0.4));
  return Math.round(start);
}

/* ---------- Timeline ---------- */

export interface Target { t0: number; dur: number; midi: number; to?: number; phrase: number; syl?: string }
export interface Timeline { targets: Target[]; phrases: { label: string; t0: number; t1: number }[]; total: number; beat: number; tonic: number }

export function buildTimeline(p: Piece, tonic: number): Timeline {
  const beat = 60 / p.bpm;
  const targets: Target[] = [];
  const phrases: Timeline['phrases'] = [];
  let t = 0;
  const reps = p.reps ?? 1;
  for (let r = 0; r < reps; r++) {
    p.phrases.forEach(ph => {
      const t0 = t;
      ph.steps.forEach(st => {
        const dur = st.beats * beat;
        if (st.s !== null) targets.push({ t0: t, dur, midi: tonic + st.s + r, to: st.to !== undefined ? tonic + st.to + r : undefined, phrase: phrases.length, syl: st.syl });
        t += dur;
      });
      phrases.push({ label: reps > 1 ? `${ph.label} ${r + 1}` : ph.label, t0, t1: t });
      t += beat; // breath between phrases
    });
  }
  return { targets, phrases, total: t, beat, tonic };
}

/** Target pitch at time t (glides are linear), or null between notes. */
export function targetAt(tl: Pick<Timeline, 'targets'>, t: number): number | null {
  const g = tl.targets.find(x => t >= x.t0 && t < x.t0 + x.dur);
  if (!g) return null;
  return g.to === undefined ? g.midi : g.midi + ((g.to - g.midi) * (t - g.t0)) / g.dur;
}

/* ---------- Scoring ---------- */

export interface TracePoint { t: number; m: number | null }

/** Score 0–100 per phrase: share of the time (after each attack) sung within tolerance, octave-folded. */
export function scorePhrases(tl: Timeline, trace: TracePoint[], tol: number): number[] {
  return tl.phrases.map((_, pi) => {
    const notes = tl.targets.filter(x => x.phrase === pi);
    const scores = notes.map(x => {
      const pts = trace.filter(p => p.t >= x.t0 + 0.12 && p.t < x.t0 + x.dur - 0.04);
      if (!pts.length) return 0;
      const good = pts.filter(p => {
        if (p.m === null) return false;
        const target = targetAt(tl, p.t);
        if (target === null) return false;
        return Math.abs((foldTo(p.m, target) - target) * 100) <= tol;
      }).length;
      return good / pts.length;
    });
    return Math.round((scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length)) * 100);
  });
}
export const average = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

/* ---------- Takes (recordings with their curve) ---------- */

export interface Take {
  id: string; pieceId: string; title: string; date: number; tol: number;
  tonic: number; score: number; phrases: number[];
  /** Pitch trace, rounded to 0.05 s / 0.01 semitone. */
  trace: TracePoint[];
  hasAudio: boolean;
  /** Seconds between the start of the recording and the start of the timeline. */
  audioOffset?: number;
}
export const TAKES_KEY = 'voice.takes';
export const MAX_TAKES = 20;
export const compactTrace = (tr: TracePoint[]) => tr.map(p => ({ t: Math.round(p.t * 100) / 100, m: p.m === null ? null : Math.round(p.m * 100) / 100 }));
