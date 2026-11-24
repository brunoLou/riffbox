/**
 * Ear training: name an interval or a chord the app plays, or play the chord the app names
 * (checked at the microphone). Questions, answers and scores; pure, no browser.
 */
import { chordType, voicingMidi, voicings } from './chords';
import { KEY_FR, mod12 } from './music';

export type EarMode = 'intervals' | 'chords' | 'play';
export type EarLevel = 1 | 2 | 3;
export const EAR_LEVEL_FR: Record<EarLevel, string> = { 1: 'Débutant', 2: 'Intermédiaire', 3: 'Avancé' };

/** Intervals, in semitones, with their French name. */
export const INTERVALS: { semis: number; name: string }[] = [
  { semis: 1, name: 'Seconde mineure' }, { semis: 2, name: 'Seconde majeure' }, { semis: 3, name: 'Tierce mineure' },
  { semis: 4, name: 'Tierce majeure' }, { semis: 5, name: 'Quarte juste' }, { semis: 6, name: 'Triton' },
  { semis: 7, name: 'Quinte juste' }, { semis: 8, name: 'Sixte mineure' }, { semis: 9, name: 'Sixte majeure' },
  { semis: 10, name: 'Septième mineure' }, { semis: 11, name: 'Septième majeure' }, { semis: 12, name: 'Octave' },
];
const INTERVAL_SETS: Record<EarLevel, number[]> = { 1: [5, 7, 12], 2: [3, 4, 5, 7, 12], 3: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] };
/** Chord qualities, by level (chord type ids). */
const CHORD_SETS: Record<EarLevel, string[]> = { 1: ['maj', 'm'], 2: ['maj', 'm', '7', 'maj7', 'm7'], 3: ['maj', 'm', '7', 'maj7', 'm7', 'sus4', 'dim', 'aug'] };
export const QUALITY_FR: Record<string, string> = {
  maj: 'Majeur', m: 'Mineur', '7': 'Septième (7)', maj7: 'Septième majeure (maj7)', m7: 'Mineur 7 (m7)', sus4: 'Suspendu (sus4)', dim: 'Diminué', aug: 'Augmenté',
};
/** Chords to play, by level (names as written in songs). */
const PLAY_SETS: Record<EarLevel, string[]> = {
  1: ['C', 'G', 'D', 'A', 'E', 'Am', 'Em', 'Dm'],
  2: ['C', 'G', 'D', 'A', 'E', 'F', 'Am', 'Em', 'Dm', 'Bm', 'A7', 'D7', 'E7', 'G7'],
  3: ['C', 'G', 'D', 'A', 'E', 'F', 'B', 'Am', 'Em', 'Dm', 'Bm', 'F#m', 'Cmaj7', 'Fmaj7', 'Am7', 'Dm7', 'Em7', 'E7', 'B7'],
};
export const playable = (lv: EarLevel) => PLAY_SETS[lv];

export interface Question {
  mode: EarMode;
  /** What to play (MIDI notes; for an interval, low then high). */
  notes: number[];
  /** The right answer (an id among `choices`). */
  answer: string;
  choices: { id: string; label: string }[];
  /** For « play »: the chord to play, and the others it must not be taken for. */
  chord?: string; candidates?: string[];
}

type Rng = () => number;
const pick = <T,>(xs: T[], rnd: Rng) => xs[Math.floor(rnd() * xs.length) % xs.length];

/** French name of a chord written in a song (« F#m » → « Fa♯ mineur »). */
export function chordFr(name: string): string {
  const m = name.match(/^([A-G])(#|b)?(.*)$/);
  if (!m) return name;
  const pc = mod12({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]]! + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0));
  const q = m[3];
  const quality = q === '' ? 'majeur' : q === 'm' ? 'mineur' : q === '7' ? 'sept' : q === 'maj7' ? 'majeur 7' : q === 'm7' ? 'mineur 7' : q;
  return `${KEY_FR[pc]} ${quality}`;
}

/** A new question; `avoid`: the previous answer (not twice in a row). */
export function makeQuestion(mode: EarMode, lv: EarLevel, rnd: Rng = Math.random, avoid?: string): Question {
  if (mode === 'intervals') {
    const set = INTERVAL_SETS[lv];
    let semis = pick(set, rnd);
    if (String(semis) === avoid && set.length > 1) semis = set[(set.indexOf(semis) + 1) % set.length];
    const low = 52 + Math.floor(rnd() * 13); // E3–E4
    return {
      mode, notes: [low, low + semis], answer: String(semis),
      choices: set.map(s => ({ id: String(s), label: INTERVALS.find(i => i.semis === s)!.name })),
    };
  }
  if (mode === 'chords') {
    const set = CHORD_SETS[lv];
    let q = pick(set, rnd);
    if (q === avoid && set.length > 1) q = set[(set.indexOf(q) + 1) % set.length];
    const root = Math.floor(rnd() * 12);
    const v = voicings(root, chordType(q))[0];
    return { mode, notes: v ? voicingMidi(v) : [], answer: q, choices: set.map(id => ({ id, label: QUALITY_FR[id] })) };
  }
  const set = PLAY_SETS[lv];
  let chord = pick(set, rnd);
  if (chord === avoid && set.length > 1) chord = set[(set.indexOf(chord) + 1) % set.length];
  return { mode, notes: [], answer: chord, choices: [], chord, candidates: set };
}

/** Scores per mode and answer: right / asked. */
export type EarStats = Partial<Record<EarMode, Record<string, { ok: number; n: number }>>>;
export const EAR_STATS_KEY = 'ear.stats';
export function recordAnswer(stats: EarStats, mode: EarMode, answer: string, ok: boolean): EarStats {
  const m = { ...(stats[mode] ?? {}) };
  const cur = m[answer] ?? { ok: 0, n: 0 };
  m[answer] = { ok: cur.ok + (ok ? 1 : 0), n: cur.n + 1 };
  return { ...stats, [mode]: m };
}
/** Overall success rate of a mode, and its weakest answer (asked at least 3 times). */
export function summary(stats: EarStats, mode: EarMode) {
  const m = stats[mode] ?? {};
  const all = Object.values(m);
  const n = all.reduce((t, x) => t + x.n, 0), ok = all.reduce((t, x) => t + x.ok, 0);
  const weakest = Object.entries(m).filter(([, x]) => x.n >= 3).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n)[0];
  return { n, rate: n ? Math.round((ok / n) * 100) : null, weakest: weakest && weakest[1].ok / weakest[1].n < 0.8 ? weakest[0] : null };
}

/** Played at the guitar: the target heard long enough (ms in a row) counts as right. */
export function heardTarget(heard: (string | null)[], target: string, frames = 4): boolean {
  let run = 0;
  for (const h of heard) { run = h === target ? run + 1 : 0; if (run >= frames) return true; }
  return false;
}
