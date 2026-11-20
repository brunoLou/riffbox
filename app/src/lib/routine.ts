import { useSyncExternalStore } from 'react';

export interface RoutineStep { id: string; name: string; short: string; detail: string; min: number; link?: { label: string; to: string } }

export const ROUTINE: RoutineStep[] = [
  { id: 'warm', name: 'Échauffement', short: 'Chromatique 1-2-3-4', detail: 'Chromatique 1-2-3-4 sur les six cordes, au métronome.', min: 5, link: { label: 'Ouvrir le métronome', to: '/metronome' } },
  { id: 'tech', name: 'Technique', short: 'Bends et vibrato', detail: 'Bends d’un ton et vibrato sur la penta de La, cases 5 à 8.', min: 8 },
  { id: 'scales', name: 'Gammes', short: 'Penta mineure de La', detail: 'Penta mineure de La, positions 1 et 2, avec la note bleue.', min: 4, link: { label: 'Ouvrir le manche', to: '/pratiquer/gammes' } },
  { id: 'impro', name: 'Impro', short: 'Impro blues en La', detail: 'Improviser sur un blues en La, shuffle à 90 BPM.', min: 8, link: { label: 'Lancer le backing', to: '/pratiquer/backing' } },
];
export const ROUTINE_MIN = ROUTINE.reduce((t, s) => t + s.min, 0);
export const GOAL_MIN = ROUTINE_MIN;

export interface RoutineState { date: string; step: number; elapsed: number[]; running: boolean; done: boolean }

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

// Demo: today's routine is already under way (steps 1–2 done, on step 3).
let state: RoutineState = { date: dayKey(), step: 2, elapsed: [300, 480, 0, 0], running: false, done: false };
const listeners = new Set<() => void>();
let timer: number | null = null;

function set(next: RoutineState) {
  state = next;
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
  elapsed[s.step] = Math.min(ROUTINE[s.step].min * 60, elapsed[s.step] + 1);
  if (elapsed[s.step] >= ROUTINE[s.step].min * 60) {
    chime();
    const last = s.step === ROUTINE.length - 1;
    if (last) stopTimer();
    set({ ...s, elapsed, step: last ? s.step : s.step + 1, running: !last, done: last });
    return;
  }
  set({ ...s, elapsed });
}
function stopTimer() { if (timer !== null) clearInterval(timer); timer = null; }

function ensureToday() {
  if (state.date !== dayKey()) set({ date: dayKey(), step: 0, elapsed: ROUTINE.map(() => 0), running: false, done: false });
}

export const routine = {
  start() {
    ensureToday();
    if (state.done) return;
    if (timer === null) timer = window.setInterval(tick, 1000);
    set({ ...state, running: true });
  },
  pause() { stopTimer(); set({ ...state, running: false }); },
  goto(step: number) {
    if (step < 0 || step >= ROUTINE.length) return;
    set({ ...state, step, done: false });
  },
  restart() { stopTimer(); set({ date: dayKey(), step: 0, elapsed: ROUTINE.map(() => 0), running: false, done: false }); },
};

export function useRoutine(): RoutineState {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => state);
}

export const doneSeconds = (s: RoutineState) => s.elapsed.reduce((a, b) => a + b, 0);

/* ---------- Weekly log ---------- */

/** Minutes practised on the previous days (demo data); today comes from the routine. */
const PAST = [32, 25, 0, 41, 27, 18];

export function week(s: RoutineState) {
  const days: { label: string; long: string; min: number; today: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const long = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(d);
    days.push({
      label: long.charAt(0).toUpperCase(), long: long.charAt(0).toUpperCase() + long.slice(1),
      min: i === 0 ? Math.floor(doneSeconds(s) / 60) : PAST[6 - i],
      today: i === 0,
    });
  }
  return days;
}

export const fmtHM = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}` : `${min} min`);
export const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
