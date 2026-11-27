/**
 * Practice without a guitar (theory, ear training): time spent answering counts as practice, per
 * day and per exercise. Only active time counts: the time between two answers, capped, so a phone
 * left on the table does not add up.
 */
import { useEffect, useRef } from 'react';
import { readStored, writeStored } from './store';

export type OffKind = 'theory' | 'progressions' | 'ear';
export const OFF_KEY = 'practice.off';
/** Seconds per day (« 2026-11-27 » as in the practice log) and exercise. */
export type OffLog = Record<string, Partial<Record<OffKind, number>>>;

/** The ten-minute session without a guitar. */
export const OFF_SESSION: { kind: OffKind; name: string; detail: string; min: number; to: string }[] = [
  { kind: 'theory', name: 'Théorie et accords', detail: 'Diagrammes, notes des accords, relatifs, degrés, capo', min: 4, to: '/pratiquer/theorie' },
  { kind: 'progressions', name: 'Suites d’accords', detail: 'Reconnaître une progression à l’oreille', min: 3, to: '/pratiquer/oreille?mode=progressions' },
  { kind: 'ear', name: 'Intervalles et accords', detail: 'Nommer un écart, la couleur d’un accord', min: 3, to: '/pratiquer/oreille?mode=intervals' },
];
export const OFF_SESSION_MIN = OFF_SESSION.reduce((t, x) => t + x.min, 0);

/** The longest pause between two answers that still counts as practice. */
export const MAX_GAP = 45;

const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
export const readOff = () => readStored<OffLog>(OFF_KEY, {});
export const offSeconds = (log: OffLog, day = dayKey(), kind?: OffKind) => {
  const d = log[day] ?? {};
  return kind ? d[kind] ?? 0 : Object.values(d).reduce((t, x) => t + (x ?? 0), 0);
};
/** Whole minutes without a guitar on a day, added to the practice minutes. */
export const offMinutes = (day: string, log = readOff()) => Math.floor(offSeconds(log, day) / 60);

export function addOff(kind: OffKind, seconds: number, day = dayKey()) {
  if (seconds <= 0) return;
  const log = readOff();
  const d = log[day] ?? {};
  writeStored(OFF_KEY, { ...log, [day]: { ...d, [kind]: Math.round(((d[kind] ?? 0) + seconds) * 10) / 10 } });
}

/** The time since the last answer (or since the screen opened), capped. */
export const activeGap = (since: number, now: number) => Math.min(MAX_GAP, Math.max(0, (now - since) / 1000));

/** Call the returned function at each answer: the active time since the previous one is counted. */
export function useOffTimer(kind: OffKind | null) {
  const last = useRef(Date.now());
  useEffect(() => { last.current = Date.now(); }, [kind]);
  return () => {
    const now = Date.now();
    if (kind) addOff(kind, activeGap(last.current, now));
    last.current = now;
  };
}

/** Days and practice log with the minutes without a guitar added (for the weekly totals). */
export function withOff(log: Record<string, number>, off: OffLog): Record<string, number> {
  const out = { ...log };
  for (const day of Object.keys(off)) {
    const m = Math.floor(offSeconds(off, day) / 60);
    if (m) out[day] = (out[day] ?? 0) + m;
  }
  return out;
}
