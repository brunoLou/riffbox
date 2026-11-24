/**
 * The coach: a practice routine composed for the player, from their goals, styles, time and level
 * per skill (measured by three short tests, or self-assessed). Pure logic, no browser.
 */
import type { RoutineStep } from './routine';
import type { Progress } from './coachProgress';

export type Goal = 'chords' | 'rhythm' | 'solo' | 'songs' | 'singing';
export type Style = 'blues' | 'rock' | 'folk' | 'chanson' | 'funk' | 'pop';
export type Skill = 'chords' | 'rhythm' | 'technique';
/** 1 débutant · 2 intermédiaire · 3 avancé. */
export type Level = 1 | 2 | 3;

export const GOALS: { id: Goal; label: string; sub: string }[] = [
  { id: 'chords', label: 'Accords et accompagnement', sub: 'Changer d’accord vite et proprement' },
  { id: 'rhythm', label: 'Rythme', sub: 'Gratter en place, avec du groove' },
  { id: 'solo', label: 'Solo et improvisation', sub: 'Gammes, phrases, improviser' },
  { id: 'songs', label: 'Jouer des morceaux', sub: 'Du début à la fin, sans s’arrêter' },
  { id: 'singing', label: 'Chanter en jouant', sub: 'La voix et la guitare ensemble' },
];
export const STYLES: { id: Style; label: string }[] = [
  { id: 'blues', label: 'Blues' }, { id: 'rock', label: 'Rock' }, { id: 'folk', label: 'Folk' },
  { id: 'chanson', label: 'Chanson' }, { id: 'funk', label: 'Funk' }, { id: 'pop', label: 'Pop' },
];
export const MINUTES = [10, 20, 30, 45] as const;
export const SKILL_FR: Record<Skill, string> = { chords: 'Accords', rhythm: 'Rythme', technique: 'Gammes et technique' };
export const LEVEL_FR: Record<Level, string> = { 1: 'Débutant', 2: 'Intermédiaire', 3: 'Avancé' };

/** What the tests measured (absent when a test was skipped). */
export interface Measures {
  /** Clean changes in one minute between two chords, and which pair. */
  changes?: number; pair?: string;
  /** Fastest tempo of the minor pentatonic in eighth notes, played cleanly (BPM). */
  scaleBpm?: number;
  /** Spread of the strums around the click (ms, standard deviation). */
  rhythmMs?: number;
}
export interface Profile {
  goals: Goal[];
  styles: Style[];
  minutes: (typeof MINUTES)[number];
  measures: Measures;
  /** Levels the player gave for a skill they did not test. */
  declared: Partial<Record<Skill, Level>>;
  date: number;
}
export const PROFILE_KEY = 'coach.profile';
/** The routine the player had before using the coach's, to go back to it. */
export const OWN_ROUTINE_KEY = 'coach.ownRoutine';

/* ---------- Levels from the tests ---------- */

/** One-minute changes: under 15 is a beginner, from 35 on it is fluent. */
export const levelFromChanges = (n: number): Level => (n < 15 ? 1 : n < 35 ? 2 : 3);
/** Pentatonic in eighths: under 70 BPM a beginner, from 110 on an advanced player. */
export const levelFromScale = (bpm: number): Level => (bpm < 70 ? 1 : bpm < 110 ? 2 : 3);
/** Strums around the click: within 20 ms is tight, beyond 45 ms still loose. */
export const levelFromRhythm = (ms: number): Level => (ms > 45 ? 1 : ms > 20 ? 2 : 3);

export function levels(p: Pick<Profile, 'measures' | 'declared'>): Record<Skill, Level> {
  const m = p.measures;
  return {
    chords: m.changes !== undefined ? levelFromChanges(m.changes) : p.declared.chords ?? 1,
    technique: m.scaleBpm !== undefined ? levelFromScale(m.scaleBpm) : p.declared.technique ?? 1,
    rhythm: m.rhythmMs !== undefined ? levelFromRhythm(m.rhythmMs) : p.declared.rhythm ?? 1,
  };
}

/**
 * Timing spread of strums around clicks: for each click, the nearest onset within ±150 ms. The
 * spread (standard deviation of the offsets) does not depend on the device's audio latency, which
 * shifts every offset by the same amount. Null when too few strums were heard.
 */
export function strumSpread(onsets: number[], clicks: number[]): { spread: number; heard: number } | null {
  const offs: number[] = [];
  for (const c of clicks) {
    let best: number | null = null;
    for (const o of onsets) if (Math.abs(o - c) <= 0.15 && (best === null || Math.abs(o - c) < Math.abs(best - c))) best = o;
    if (best !== null) offs.push(best - c);
  }
  if (offs.length < Math.max(6, clicks.length * 0.4)) return null;
  // The device latency moves every strum by the same amount: the spread around their mean ignores it.
  const mean = offs.reduce((t, o) => t + o, 0) / offs.length;
  const dev = offs.map(o => o - mean);
  const sd = Math.sqrt(dev.reduce((t, d) => t + d * d, 0) / dev.length);
  return { spread: Math.round(sd * 1000), heard: offs.length };
}

/** Clean changes between two chords from the chords heard (each held a moment, in alternation). */
export function countChanges(heard: (string | null)[], a: string, b: string, minFrames = 2): number {
  let last: string | null = null, run = 0, cand: string | null = null, n = 0;
  for (const h of heard) {
    if (h !== a && h !== b) { cand = null; run = 0; continue; }
    if (h === cand) run++; else { cand = h; run = 1; }
    if (run === minFrames && cand !== last) { if (last !== null) n++; last = cand; }
  }
  return n;
}

/* ---------- Exercises ---------- */

/** Backing track and key that suit a style. */
const STYLE_TRACK: Record<Style, { track: string; key: number; name: string }> = {
  blues: { track: 'b1', key: 9, name: 'blues en La' }, rock: { track: 'r1', key: 4, name: 'rock en Mi' },
  funk: { track: 'f1', key: 4, name: 'funk en Mi m' }, folk: { track: 'r2', key: 7, name: 'rock en Sol' },
  chanson: { track: 'r2', key: 7, name: 'en Sol' }, pop: { track: 'r2', key: 7, name: 'en Sol' },
};
/** Chord pairs to drill, by level and style. */
const PAIRS: Record<Level, string[]> = {
  1: ['Do ↔ Sol', 'La m ↔ Mi', 'Ré ↔ La', 'Mi m ↔ Do', 'Sol ↔ Ré'],
  2: ['Fa (barré) ↔ Do', 'Si m ↔ Sol', 'La7 ↔ Ré7', 'Fa♯ m ↔ Ré', 'Do ↔ La m7'],
  3: ['Do maj7 ↔ La m7', 'Ré m7 ↔ Sol7 ↔ Do maj7', 'Si m7 ↔ Mi7 ↔ La maj7', 'Fa♯ m7♭5 ↔ Si7'],
};

interface Exercise { name: string; detail: string; link?: RoutineStep['link'] }
type Builder = (lv: Level, ctx: { style: Style; m: Measures; day: number }) => Exercise;

const metro = (bpm: number, label = 'Ouvrir le métronome'): RoutineStep['link'] => ({ label, to: '/metronome', set: { 'metro.bpm': bpm, 'metro.groove': 'clic' } });
const pick = <T,>(list: T[], day: number) => list[((day % list.length) + list.length) % list.length];

const EXERCISES: Record<'warm' | 'chords' | 'rhythm' | 'technique' | 'impro' | 'songs' | 'singing', Builder> = {
  warm: lv => ({
    name: 'Échauffement',
    detail: lv === 1 ? 'Doigts 1-2-3-4 sur chaque corde, une note par clic, sans forcer : précision avant vitesse.'
      : lv === 2 ? 'Chromatique 1-2-3-4 sur les six cordes en croches, aller et retour, en aller-retour de médiator.'
      : 'Chromatique et sauts de cordes en croches, puis legato (hammer-on, pull-off) sur deux cordes.',
    link: metro(lv === 1 ? 60 : lv === 2 ? 80 : 100),
  }),
  chords: (lv, { m, day }) => {
    const pair = lv === 1 && m.pair && day % 2 === 0 ? m.pair : pick(PAIRS[lv], day);
    const target = m.changes !== undefined ? ` Dernier test : ${m.changes} changements. Visez ${m.changes + 5}.` : '';
    return {
      name: 'Accords',
      detail: lv === 1 ? `Changements d’une minute : ${pair}. Comptez les changements propres, toutes les notes doivent sonner.${target}`
        : lv === 2 ? `Changements d’une minute : ${pair}, puis enchaînez-les sur 4 temps au métronome.${target}`
        : `Enchaînement ${pair} dans deux positions du manche, puis en renversements sur les cordes aiguës.`,
      link: lv === 3 ? { label: 'Ouvrir les accords', to: '/pratiquer/accords' } : metro(lv === 1 ? 60 : 80),
    };
  },
  rhythm: (lv, { style }) => {
    const funk = style === 'funk';
    return {
      name: 'Rythme',
      detail: lv === 1 ? 'Grattez en descendant sur chaque temps, puis le motif bas, bas, haut, haut, bas, haut. Le bras ne s’arrête jamais.'
        : lv === 2 ? (funk ? 'Croches en aller-retour avec étouffements (ghost notes), accent sur 2 et 4.' : 'Croches en aller-retour, accents sur 2 et 4, puis le même motif en shuffle et en palm mute.')
        : 'Doubles croches : accents déplacés, ghost notes et silences précis, en gardant le bras en mouvement.',
      link: { label: 'Ouvrir le métronome', to: '/metronome', set: { 'metro.bpm': lv === 1 ? 70 : lv === 2 ? 90 : 96, 'metro.groove': lv === 1 ? 'clic' : funk || lv === 3 ? 'funk' : 'rock' } },
    };
  },
  technique: (lv, { m, style }) => {
    const bpm = Math.max(50, Math.min(140, Math.round(((m.scaleBpm ?? (lv === 1 ? 60 : lv === 2 ? 80 : 110)) * 0.9) / 2) * 2));
    const key = STYLE_TRACK[style].key;
    return {
      name: 'Gammes',
      detail: lv === 1 ? `Penta mineure, position 1, en noires à ${bpm} BPM : une note par clic, montée et descente.`
        : lv === 2 ? `Penta mineure, positions 1 et 2, en croches à ${bpm} BPM ; reliez les deux positions.`
        : `Penta et gamme blues sur tout le manche (5 positions) en croches à ${bpm} BPM, puis en triolets.`,
      link: { label: 'Ouvrir le manche', to: '/pratiquer/gammes', set: { 'scale.id': lv === 3 ? 'blues' : 'pmin', 'scale.key': key, 'metro.bpm': bpm } },
    };
  },
  impro: (lv, { style }) => {
    const t = STYLE_TRACK[style];
    return {
      name: 'Impro',
      detail: lv === 1 ? `Improvisez avec 3 notes de la penta sur le ${t.name} : des phrases courtes, et des silences.`
        : lv === 2 ? `Questions-réponses sur le ${t.name} : une phrase, puis sa réponse ; ajoutez bends et vibrato.`
        : `Sur le ${t.name}, visez la note de chaque accord au changement (arpèges), puis improvisez autour.`,
      link: { label: 'Lancer le backing', to: '/pratiquer/backing', set: { 'backing.sel': t.track, 'backing.source': 'app' } },
    };
  },
  songs: lv => ({
    name: 'Morceau',
    detail: lv === 1 ? 'Un morceau de la bibliothèque, lentement : le couplet et le refrain sans vous arrêter, même si un accord frise.'
      : lv === 2 ? 'Un morceau entier au tempo, sans vous arrêter ; travaillez à part le passage qui coince.'
      : 'Un morceau en conditions de concert : d’un bout à l’autre, nuances et fin comprises, comme sur scène.',
    link: { label: 'Ouvrir les morceaux', to: '/scene/morceaux' },
  }),
  singing: lv => ({
    name: 'Chant',
    detail: lv === 1 ? 'Grattez un accord par mesure et chantez la mélodie par-dessus ; échauffez la voix avant.'
      : 'Chantez en jouant le vrai rythme ; vérifiez la justesse de la mélodie à part.',
    link: { label: 'Ouvrir la justesse vocale', to: '/voix' },
  }),
};

/* ---------- The routine of the day ---------- */

/** Days since 1970: changes the exercises from one day to the next. */
export const dayNumber = (d = new Date()) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);

/**
 * Today's routine: a warm-up, then blocks for the goals (the weakest skill gets more time), in the
 * time the player has. With more goals than room, they take turns from one day to the next.
 */
export function coachRoutine(p: Profile, day = dayNumber(), progress: Progress = {}): RoutineStep[] {
  const lv = levels(p);
  const style = p.styles.length ? p.styles[day % p.styles.length] : 'blues';
  const ctx = { style, m: p.measures, day };
  const goals = p.goals.length ? p.goals : (['chords', 'solo'] as Goal[]);
  // Blocks for each goal (solo is gammes + impro), with the level that drives them.
  const blocksOf: Record<Goal, { ex: keyof typeof EXERCISES; level: Level; skill?: Skill }[]> = {
    chords: [{ ex: 'chords', level: lv.chords, skill: 'chords' }],
    rhythm: [{ ex: 'rhythm', level: lv.rhythm, skill: 'rhythm' }],
    solo: [{ ex: 'technique', level: lv.technique, skill: 'technique' }, { ex: 'impro', level: lv.technique }],
    songs: [{ ex: 'songs', level: lv.chords }],
    singing: [{ ex: 'singing', level: lv.chords }],
  };
  const slots = p.minutes <= 10 ? 2 : p.minutes <= 20 ? 3 : p.minutes <= 30 ? 4 : 5;
  const rotated = goals.map((_, i) => goals[(i + day) % goals.length]);
  const all = rotated.flatMap(g => blocksOf[g]);
  const blocks = all.slice(0, slots);
  // The weakest measured skill comes first and gets half as much time again.
  const weakest = (Object.keys(lv) as Skill[]).sort((a, b) => lv[a] - lv[b])[0];
  blocks.sort((a, b) => Number(b.skill === weakest) - Number(a.skill === weakest));

  const warmMin = Math.max(2, Math.round(p.minutes * 0.15));
  const rest = p.minutes - warmMin;
  const weights = blocks.map(b => (b.skill === weakest && lv[weakest] < 3 ? 1.5 : 1));
  const total = weights.reduce((t, w) => t + w, 0);
  const mins = weights.map(w => Math.max(2, Math.floor((rest * w) / total)));
  // Whatever rounding left goes to the first block.
  mins[0] += rest - mins.reduce((t, m) => t + m, 0);

  const warmLevel = Math.min(lv.technique, lv.chords) as Level;
  const steps: RoutineStep[] = [{ ...EXERCISES.warm(warmLevel, ctx), id: 'coach-warm', short: '', min: warmMin }];
  blocks.forEach((b, i) => steps.push({ ...EXERCISES[b.ex](b.level, ctx), id: `coach-${b.ex}`, short: '', min: mins[i] }));
  // The tempo the coach has reached with the player replaces the starting one.
  const tempoOf = (id: string) => progress[id.replace(/^coach-/, '') as keyof Progress]?.bpm;
  return steps.map(s => {
    const bpm = tempoOf(s.id);
    const step = { ...s, short: s.detail.split(/[.:;]/)[0].slice(0, 34) };
    if (!bpm || !s.link?.set || !('metro.bpm' in s.link.set)) return step;
    return {
      ...step,
      detail: `${s.detail.replace(/à \d+ BPM/, `à ${bpm} BPM`)}${/\d+ BPM/.test(s.detail) ? '' : ` Tempo du jour : ${bpm} BPM.`}`,
      link: { ...s.link, set: { ...s.link.set, 'metro.bpm': bpm } },
    };
  });
}
