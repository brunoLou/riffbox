/** Progress over time: practice per week, tempos reached by the coach's exercises. Pure, no browser. */
import type { Progress, TempoEx } from './coachProgress';
import { TEMPO_EX } from './coachProgress';

const key = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const DAY = 86400000;

export interface WeekTotal { start: Date; min: number; current: boolean }
/**
 * Minutes per week (Monday to Sunday), the last `n` weeks up to this one; today's minutes come from
 * the routine in progress (`todayMin`) rather than the log.
 */
export function weeklyMinutes(log: Record<string, number>, today: Date, todayMin: number, n = 12): WeekTotal[] {
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const out: WeekTotal[] = [];
  for (let w = n - 1; w >= 0; w--) {
    const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7 * w);
    let min = 0;
    for (let d = 0; d < 7; d++) {
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + d);
      if (day > today) break;
      min += key(day) === key(today) ? todayMin : log[key(day)] ?? 0;
    }
    out.push({ start, min, current: w === 0 });
  }
  return out;
}

export interface TempoPoint { day: number; bpm: number; feel?: 'easy' | 'ok' | 'hard'; next?: boolean }
/** Each coach exercise's tempos, session after session, ending with the next one planned. */
export function tempoSeries(p: Progress): { ex: TempoEx; points: TempoPoint[] }[] {
  return TEMPO_EX.filter(ex => p[ex]?.history.length).map(ex => {
    const h = p[ex]!.history;
    return { ex, points: [...h.map(x => ({ day: x.day, bpm: x.bpm, feel: x.feel })), { day: h[h.length - 1].day + 1, bpm: p[ex]!.bpm, next: true }] };
  });
}

/** Date of a day number (days since 1970, local). */
export const dateOfDay = (day: number) => { const d = new Date(day * DAY); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };
