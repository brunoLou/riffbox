/**
 * Ear training: name an interval or a chord the app plays, or play the chord the app names
 * (checked at the microphone). Questions, answers and scores; pure, no browser.
 */
import { chordType, voicingMidi, voicings } from './chords';
import { KEY_FR, mod12 } from './music';
import { above, chordShow, keyTonic, minorTonic, noteFr, type TChord } from './theory';

export type EarMode = 'intervals' | 'chords' | 'progressions' | 'play';
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

/** Chord progressions to recognise: each chord as semitones above the tonic, its letter step, and minor or not. */
interface ProgDef { id: string; label: string; minorKey?: boolean; chords: [semis: number, steps: number, minor: boolean][] }
export const PROGRESSIONS: ProgDef[] = [
  { id: 'I-IV-V-I', label: 'I – IV – V – I', chords: [[0, 0, false], [5, 3, false], [7, 4, false], [0, 0, false]] },
  { id: 'I-V-vi-IV', label: 'I – V – vi – IV (pop)', chords: [[0, 0, false], [7, 4, false], [9, 5, true], [5, 3, false]] },
  { id: 'I-vi-IV-V', label: 'I – vi – IV – V (années 50)', chords: [[0, 0, false], [9, 5, true], [5, 3, false], [7, 4, false]] },
  { id: 'ii-V-I', label: 'ii – V – I (jazz)', chords: [[2, 1, true], [7, 4, false], [0, 0, false], [0, 0, false]] },
  { id: 'vi-IV-I-V', label: 'vi – IV – I – V', chords: [[9, 5, true], [5, 3, false], [0, 0, false], [7, 4, false]] },
  { id: 'I-bVII-IV-I', label: 'I – ♭VII – IV – I (rock)', chords: [[0, 0, false], [10, 6, false], [5, 3, false], [0, 0, false]] },
  { id: 'i-bVII-bVI-V', label: 'i – ♭VII – ♭VI – V (andalouse)', minorKey: true, chords: [[0, 0, true], [10, 6, false], [8, 5, false], [7, 4, false]] },
  { id: 'I-IV-vi-V', label: 'I – IV – vi – V', chords: [[0, 0, false], [5, 3, false], [9, 5, true], [7, 4, false]] },
  { id: 'I-iii-IV-V', label: 'I – iii – IV – V', chords: [[0, 0, false], [4, 2, true], [5, 3, false], [7, 4, false]] },
];
const PROG_SETS: Record<EarLevel, string[]> = {
  1: ['I-IV-V-I', 'I-V-vi-IV', 'I-vi-IV-V'],
  2: ['I-IV-V-I', 'I-V-vi-IV', 'I-vi-IV-V', 'ii-V-I', 'vi-IV-I-V', 'I-bVII-IV-I'],
  3: PROGRESSIONS.map(p => p.id),
};
export const progressionDef = (id: string) => PROGRESSIONS.find(p => p.id === id);
/** The chords of a progression in a key, spelled (« G – D – Em – C »). */
export function progressionChords(id: string, key: number): TChord[] {
  const p = progressionDef(id)!;
  const t = p.minorKey ? minorTonic(key) : keyTonic(key);
  return p.chords.map(([semis, steps, minor]) => ({ root: above(t, semis, steps), type: chordType(minor ? 'm' : 'maj') }));
}

export interface Question {
  mode: EarMode;
  /** What to play (MIDI notes; for an interval, low then high). */
  notes: number[];
  /** The right answer (an id among `choices`). */
  answer: string;
  choices: { id: string; label: string }[];
  /** For « play »: the chord to play, and the others it must not be taken for. */
  chord?: string; candidates?: string[];
  /** For a progression: one chord after the other (MIDI notes each), and what they were. */
  seq?: number[][]; reveal?: string;
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
  if (mode === 'progressions') {
    const set = PROG_SETS[lv];
    let id = pick(set, rnd);
    if (id === avoid && set.length > 1) id = set[(set.indexOf(id) + 1) % set.length];
    const key = Math.floor(rnd() * 12);
    const chords = progressionChords(id, key);
    const p = progressionDef(id)!;
    // Close voicings around the middle of the guitar, the root in the bass.
    const seq = chords.map(c => {
      const root = 40 + mod12(c.root.pc - 4);
      const third = c.type.id === 'm' ? 3 : 4;
      return [root, root + 7, root + 12, root + 12 + third, root + 19];
    });
    return {
      mode, notes: [], seq, answer: id, choices: set.map(x => ({ id: x, label: progressionDef(x)!.label })),
      reveal: `En ${noteFr(p.minorKey ? minorTonic(key) : keyTonic(key))} ${p.minorKey ? 'mineur' : 'majeur'} : ${chords.map(chordShow).join(' – ')}`,
    };
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
