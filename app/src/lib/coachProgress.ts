/**
 * The coach over time: tempos that rise when an exercise feels easy (the player says how it went
 * after each step), a weekly review, and a monthly test compared with the first check-up.
 * Pure logic, no browser.
 */
import { SKILL_FR, type Measures, type Skill } from './coach';

export type TempoEx = 'warm' | 'chords' | 'rhythm' | 'technique';
export type Feel = 'easy' | 'ok' | 'hard';
export const TEMPO_EX: TempoEx[] = ['warm', 'chords', 'rhythm', 'technique'];
export const EX_FR: Record<TempoEx, string> = { warm: 'Échauffement', chords: 'Accords', rhythm: 'Rythme', technique: 'Gammes' };
export const FEEL_FR: Record<Feel, string> = { easy: 'Facile', ok: 'Juste', hard: 'Difficile' };

export interface ExProgress { bpm: number; history: { day: number; bpm: number; feel: Feel }[] }
export type Progress = Partial<Record<TempoEx, ExProgress>>;
export const PROGRESS_KEY = 'coach.progress';
/** Every check-up (the first one, then each month's test). */
export interface Checkup { date: number; measures: Measures }
export const TESTS_KEY = 'coach.tests';

const MIN_BPM = 40, MAX_BPM = 200;
const clamp = (n: number) => Math.max(MIN_BPM, Math.min(MAX_BPM, n));

/** The exercise behind a coach step of the routine (« coach-rhythm » → rhythm). */
export const exOfStep = (id: string): TempoEx | null => {
  const ex = id.replace(/^coach-/, '');
  return id.startsWith('coach-') && (TEMPO_EX as string[]).includes(ex) ? (ex as TempoEx) : null;
};

/**
 * Next tempo after a session at `bpm`: easy → 4 up; hard → 4 down; « juste » twice in a row → 2
 * up (it is getting clean), else the same.
 */
export function nextBpm(bpm: number, feel: Feel, before: Feel | undefined): number {
  if (feel === 'easy') return clamp(bpm + 4);
  if (feel === 'hard') return clamp(bpm - 4);
  return clamp(before === 'ok' ? bpm + 2 : bpm);
}

/** How today's session of an exercise went, played at `played` BPM (a second answer today replaces the first). */
export function recordFeel(p: Progress, ex: TempoEx, played: number, feel: Feel, day: number): Progress {
  const history = (p[ex]?.history ?? []).filter(h => h.day !== day);
  const bpmToday = p[ex]?.history.find(h => h.day === day)?.bpm ?? played;
  const before = history[history.length - 1]?.feel;
  return { ...p, [ex]: { bpm: nextBpm(bpmToday, feel, before), history: [...history, { day, bpm: bpmToday, feel }].slice(-120) } };
}

export const feelToday = (p: Progress, ex: TempoEx, day: number) => p[ex]?.history.find(h => h.day === day)?.feel;

export interface WeekReview {
  minutes: number; days: number;
  tempos: { ex: TempoEx; from: number; to: number }[];
  /** Exercises found hard at least twice this week. */
  hard: TempoEx[];
  advice: string;
}
/** The last seven days: practice (minutes per day, today included) and tempos gained. */
export function weekReview(p: Progress, minutesPerDay: number[], day: number): WeekReview {
  const minutes = minutesPerDay.reduce((t, m) => t + m, 0);
  const days = minutesPerDay.filter(m => m > 0).length;
  const tempos: WeekReview['tempos'] = [];
  const hard: TempoEx[] = [];
  for (const ex of TEMPO_EX) {
    const h = (p[ex]?.history ?? []).filter(x => x.day > day - 7);
    if (!h.length) continue;
    tempos.push({ ex, from: h[0].bpm, to: p[ex]!.bpm });
    if (h.filter(x => x.feel === 'hard').length >= 2) hard.push(ex);
  }
  const gained = tempos.filter(t => t.to > t.from);
  const advice = days === 0 ? 'Pas encore de pratique cette semaine : 10 minutes aujourd’hui relancent tout.'
    : days < 4 ? `${days} jour${days > 1 ? 's' : ''} sur 7 : visez 5 jours, même courts. La régularité compte plus que la durée.`
    : hard.length ? `${hard.map(e => EX_FR[e]).join(' et ')} vous résiste : le tempo a baissé, jouez propre avant de jouer vite.`
    : gained.length ? `Belle semaine : ${gained.map(t => `${EX_FR[t.ex].toLowerCase()} +${t.to - t.from} BPM`).join(', ')}. Continuez comme ça.`
    : 'Semaine régulière. Quand un exercice devient facile, dites-le : le tempo montera.';
  return { minutes, days, tempos, hard, advice };
}

const DAY_MS = 86400000;
/** The monthly test is due four weeks after the last check-up. */
export function monthlyDue(lastCheckup: number, now = Date.now()): { due: boolean; inDays: number } {
  const inDays = Math.ceil((lastCheckup + 28 * DAY_MS - now) / DAY_MS);
  return { due: inDays <= 0, inDays: Math.max(0, inDays) };
}

export interface Change { skill: Skill; label: string; from: number; to: number; unit: string; better: boolean }
/** What changed between two check-ups (only what both measured). */
export function compareCheckups(a: Measures, b: Measures): Change[] {
  const out: Change[] = [];
  if (a.changes !== undefined && b.changes !== undefined) out.push({ skill: 'chords', label: SKILL_FR.chords, from: a.changes, to: b.changes, unit: 'changements / min', better: b.changes > a.changes });
  if (a.scaleBpm !== undefined && b.scaleBpm !== undefined) out.push({ skill: 'technique', label: SKILL_FR.technique, from: a.scaleBpm, to: b.scaleBpm, unit: 'BPM', better: b.scaleBpm > a.scaleBpm });
  if (a.rhythmMs !== undefined && b.rhythmMs !== undefined) out.push({ skill: 'rhythm', label: SKILL_FR.rhythm, from: a.rhythmMs, to: b.rhythmMs, unit: 'ms d’écart', better: b.rhythmMs < a.rhythmMs });
  return out;
}
