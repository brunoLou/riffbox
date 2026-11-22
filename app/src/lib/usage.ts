/**
 * Tools used today: the home board lights a pedal's LED once its tool has really been used
 * (a note heard, the metronome started, an idea saved…). Everything goes dark the next day.
 * Kept on each device (not transferred).
 */
import { useEffect } from 'react';
import { readStored, useStoredState, writeStored } from './store';

export const USAGE_KEY = 'usage.today';
interface Usage { date: string; ids: string[] }
const EMPTY: Usage = { date: '', ids: [] };
const today = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/** Light the LED of tile `id` for today. */
export function markUsed(id: string) {
  const d = today();
  const u = readStored<Usage>(USAGE_KEY, EMPTY);
  if (u.date === d && u.ids.includes(id)) return;
  writeStored(USAGE_KEY, { date: d, ids: u.date === d ? [...u.ids, id] : [id] });
}

/** Ids of the tools used today (updates live). */
export function useUsedToday(): Set<string> {
  const [u] = useStoredState<Usage>(USAGE_KEY, EMPTY);
  return new Set(u.date === today() ? u.ids : []);
}

/** For reference tools: opening the screen counts as using it. */
export function useMarkUsed(id: string, when = true) {
  useEffect(() => { if (when) markUsed(id); }, [id, when]);
}
