import { useSyncExternalStore } from 'react';
import { readStored, writeStored } from './store';
import { markUsed } from './usage';

export interface RoutineStep { id: string; name: string; short: string; detail: string; min: number; link?: { label: string; to: string } }

/** The routine on first launch (and after « Rétablir »). */
export const DEFAULT_ROUTINE: RoutineStep[] = [
  { id: 'warm', name: 'Échauffement', short: 'Chromatique 1-2-3-4', detail: 'Chromatique 1-2-3-4 sur les six cordes, au métronome.', min: 5, link: { label: 'Ouvrir le métronome', to: '/metronome' } },
  { id: 'tech', name: 'Technique', short: 'Bends et vibrato', detail: 'Bends d’un ton et vibrato sur la penta de La, cases 5 à 8.', min: 8 },
  { id: 'scales', name: 'Gammes', short: 'Penta mineure de La', detail: 'Penta mineure de La, positions 1 et 2, avec la note bleue.', min: 4, link: { label: 'Ouvrir le manche', to: '/pratiquer/gammes' } },
  { id: 'impro', name: 'Impro', short: 'Impro blues en La', detail: 'Improviser sur un blues en La, shuffle à 90 BPM.', min: 8, link: { label: 'Lancer le backing', to: '/pratiquer/backing' } },
];

/** Tools a step can open. */
export const STEP_TOOLS: { name: string; label: string; to: string }[] = [
  { name: 'Métronome', label: 'Ouvrir le métronome', to: '/metronome' },
  { name: 'Accordeur', label: 'Ouvrir l’accordeur', to: '/accordeur' },
  { name: 'Gammes', label: 'Ouvrir le manche', to: '/pratiquer/gammes' },
  { name: 'Accords', label: 'Ouvrir les accords', to: '/pratiquer/accords' },
  { name: 'Backing tracks', label: 'Lancer le backing', to: '/pratiquer/backing' },
  { name: 'Grilles', label: 'Ouvrir les grilles', to: '/composer/grilles' },
  { name: 'Voix', label: 'Ouvrir la justesse vocale', to: '/voix' },
  { name: 'Morceaux', label: 'Ouvrir les morceaux', to: '/scene/morceaux' },
];
export const STEP_LIMITS = { steps: 8, minMin: 1, maxMin: 60 };

/** Short text for the home card: the first part of the instructions, else the name. */
export const shortOf = (name: string, detail: string) => {
  const first = detail.split(/[.;:\n]/)[0].trim();
  return first.length > 34 ? first.slice(0, 33).trimEnd() + '…' : first || name;
};

const STEPS_KEY = 'routine.steps';
let steps: RoutineStep[] = readStored<RoutineStep[]>(STEPS_KEY, DEFAULT_ROUTINE);
/** The player's routine (editable in Pratiquer › Routine › Modifier). */
export const routineSteps = () => steps;
export const routineMin = () => steps.reduce((t, x) => t + x.min, 0);

export interface RoutineState { date: string; step: number; elapsed: number[]; running: boolean; done: boolean }

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

// Demo on first launch: today's routine is already under way (steps 1–2 done, on step 3).
// Afterwards the saved state is restored (paused; the timer never runs in the background of a closed app).
const DEMO_ELAPSED = [300, 480, 0, 0];
const saved = readStored<RoutineState>('routine', { date: dayKey(), step: 2, elapsed: DEMO_ELAPSED, running: false, done: false });
// Always one elapsed time per step, whatever was saved.
let state: RoutineState = { ...saved, elapsed: steps.map((_, i) => saved.elapsed[i] ?? 0), step: Math.min(saved.step, steps.length - 1), running: false };
const listeners = new Set<() => void>();
let timer: number | null = null;

function set(next: RoutineState) {
  const prev = state;
  state = next;
  writeStored('routine', next);
  // Keep today's minutes in the practice log; whole minutes only, so this writes about once a minute.
  const min = Math.floor(doneSeconds(next) / 60);
  if (min !== Math.floor(doneSeconds(prev) / 60) || prev.date !== next.date) {
    const log = readLog();
    if (log[next.date] !== min) writeStored(LOG_KEY, { ...log, [next.date]: min });
  }
  listeners.forEach(l => l());
}

function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new Ctx();
    [880, 1318.5].forEach((f, i) => {
      const t = ac.currentTime + i * 0.18;
      const o = ac.createOscillator(); const g = ac.createGain();
      o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.55);
    });
    setTimeout(() => void ac.close(), 1200);
  } catch { /* no audio */ }
}

function tick() {
  const s = state;
  if (!s.running) return;
  const elapsed = s.elapsed.slice();
  elapsed[s.step] = Math.min(steps[s.step].min * 60, elapsed[s.step] + 1);
  if (elapsed[s.step] >= steps[s.step].min * 60) {
    chime();
    const last = s.step === steps.length - 1;
    if (last) stopTimer();
    set({ ...s, elapsed, step: last ? s.step : s.step + 1, running: !last, done: last });
    return;
  }
  set({ ...s, elapsed });
}
function stopTimer() { if (timer !== null) clearInterval(timer); timer = null; }

function ensureToday() {
  if (state.date !== dayKey()) set({ date: dayKey(), step: 0, elapsed: steps.map(() => 0), running: false, done: false });
}

export const routine = {
  start() {
    markUsed('routine');
    ensureToday();
    if (state.done) return;
    if (timer === null) timer = window.setInterval(tick, 1000);
    set({ ...state, running: true });
  },
  pause() { stopTimer(); set({ ...state, running: false }); },
  goto(step: number) {
    if (step < 0 || step >= steps.length) return;
    set({ ...state, step, done: false });
  },
  restart() { stopTimer(); set({ date: dayKey(), step: 0, elapsed: steps.map(() => 0), running: false, done: false }); },
  /**
   * Replace the routine. Today's time is kept for the steps that remain (matched by id, capped to
   * their new length); the timer pauses, and the current step stays the same when it still exists.
   */
  setSteps(next: RoutineStep[]) {
    stopTimer();
    const before = new Map(steps.map((x, i) => [x.id, state.elapsed[i] ?? 0]));
    const curId = steps[state.step]?.id;
    steps = next;
    writeStored(STEPS_KEY, next);
    const elapsed = next.map(x => Math.min(x.min * 60, before.get(x.id) ?? 0));
    const done = elapsed.every((e, i) => e >= next[i].min * 60);
    const firstLeft = elapsed.findIndex((e, i) => e < next[i].min * 60);
    const kept = next.findIndex(x => x.id === curId);
    const step = done ? next.length - 1 : kept >= 0 && elapsed[kept] < next[kept].min * 60 ? kept : Math.max(0, firstLeft);
    set({ ...state, date: dayKey(), elapsed, step, running: false, done });
  },
};

export function useRoutine(): RoutineState {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => state);
}

export const doneSeconds = (s: RoutineState) => s.elapsed.reduce((a, b) => a + b, 0);

/* ---------- Weekly log ---------- */

const LOG_KEY = 'practice.log';
type Log = Record<string, number>;

/** Minutes per day. Seeded once with demo values for the six previous days. */
function readLog(): Log {
  const log = readStored<Log | null>(LOG_KEY, null);
  if (log) return log;
  const demo = [32, 25, 0, 41, 27, 18];
  const seeded: Log = {};
  demo.forEach((m, i) => { seeded[dayKey(new Date(Date.now() - (6 - i) * 86400000))] = m; });
  writeStored(LOG_KEY, seeded);
  writeStored(SEEDED_KEY, Object.keys(seeded));
  return seeded;
}
const SEEDED_KEY = 'practice.seeded';

/** Example practice data still present: seeded past days, and today's untouched demo routine. */
export function demoPractice() {
  const seeded = readStored<string[]>(SEEDED_KEY, []);
  const log = readLog();
  const days = seeded.filter(d => d in log);
  const routineIsDemo = state.date === dayKey() && !state.running && state.elapsed.join() === DEMO_ELAPSED.join();
  return { days: days.length, routineIsDemo };
}

/** Remove the example practice data, keeping real sessions. */
export function clearDemoPractice() {
  const seeded = new Set(readStored<string[]>(SEEDED_KEY, []));
  const log = readLog();
  writeStored(LOG_KEY, Object.fromEntries(Object.entries(log).filter(([d]) => !seeded.has(d))));
  writeStored(SEEDED_KEY, []);
  if (demoPractice().routineIsDemo) routine.restart();
}

/** Consecutive days with practice, ending today (or yesterday if today is still empty). */
export function streak(s: RoutineState) {
  const log = readLog();
  const minutesOn = (d: Date) => (dayKey(d) === s.date ? Math.floor(doneSeconds(s) / 60) : log[dayKey(d)] ?? 0);
  let n = 0;
  const day = new Date();
  if (!minutesOn(day)) day.setDate(day.getDate() - 1);
  while (minutesOn(day) > 0) { n++; day.setDate(day.getDate() - 1); }
  // The last five days, oldest first, for the dots on the home card.
  const recent = [4, 3, 2, 1, 0].map(i => minutesOn(new Date(Date.now() - i * 86400000)) > 0);
  return { days: n, recent };
}

export function week(s: RoutineState) {
  const log = readLog();
  const days: { label: string; long: string; min: number; today: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const long = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(d);
    days.push({
      label: long.charAt(0).toUpperCase(), long: long.charAt(0).toUpperCase() + long.slice(1),
      min: i === 0 ? Math.floor(doneSeconds(s) / 60) : log[dayKey(d)] ?? 0,
      today: i === 0,
    });
  }
  return days;
}

export const fmtHM = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}` : `${min} min`);
export const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

// A new day starts a fresh routine (yesterday's minutes stay in the log).
ensureToday();
