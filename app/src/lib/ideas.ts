import { KEY_FR } from './music';
import { registerSerializer } from './store';
import type { Tab } from './tab';

registerSerializer<Idea[]>('ideas', list => list.map(({ audioUrl: _url, ...rest }) => rest));

export type IdeaKind = 'riff' | 'grille' | 'paroles' | 'memo';

export interface Idea {
  id: string;
  kind: IdeaKind;
  title: string;
  created: number;
  key?: number;
  minor?: boolean;
  bpm?: number;
  style?: string;
  mood?: string;
  /** Seconds, for audio ideas. */
  duration?: number;
  /** 0–1 bar heights, for audio ideas. */
  wave?: number[];
  chords?: string[];
  text?: string;
  /** A real recording exists in IndexedDB under this idea's id. */
  hasAudio?: boolean;
  /** Object URL of that recording, for this session only (never saved). */
  audioUrl?: string;
  /** MIDI notes of a synthesized example phrase (8th notes). */
  lick?: number[];
  /** A riff written in tablature. */
  tab?: Tab;
  /** Screen opened by "Ouvrir". */
  to?: string;
}

export const KIND_LABEL: Record<IdeaKind, string> = { riff: 'Riff', grille: 'Grille', paroles: 'Paroles', memo: 'Mémo vocal' };
export const STYLES = ['Blues', 'Rock', 'Funk'];
export const MOODS = ['Nostalgique', 'Énergique', 'Groovy', 'Mélancolique', 'Sombre'];

export const keyLabel = (i: Pick<Idea, 'key' | 'minor'>) => (i.key == null ? '' : KEY_FR[i.key] + (i.minor ? ' m' : ''));

/** Deterministic pseudo-waveform so examples look the same on every load. */
export function fakeWave(seed: string, n = 44): number[] {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    const env = Math.sin((Math.PI * (i + 1)) / (n + 1)) * 0.55 + 0.35;
    out.push(Math.max(0.12, Math.min(1, env * (0.45 + (h / 2 ** 32) * 0.75))));
  }
  return out;
}

const lickDur = (lick: number[], bpm: number) => (lick.length * 30) / bpm;

const DAY = 86400000;
const now = Date.now();

function example(i: Omit<Idea, 'wave' | 'duration'>): Idea {
  const audio = !!i.lick;
  return { ...i, wave: audio ? fakeWave(i.id) : undefined, duration: audio ? lickDur(i.lick!, i.bpm ?? 90) : undefined };
}

/** Example content for the mock-up (melodies are synthesized on playback). */
export const INITIAL_IDEAS: Idea[] = [
  example({
    id: 'i1', kind: 'riff', title: 'Riff shuffle en La', created: now - 2 * 3600000, key: 9, bpm: 92, style: 'Blues', mood: 'Nostalgique',
    lick: [57, 60, 62, 63, 64, 67, 64, 62, 60, 57, 60, 57, 55, 57, 57, 57],
  }),
  example({
    id: 'i3', kind: 'paroles', title: 'Néons du quai', created: now - 2 * DAY, style: 'Blues', mood: 'Mélancolique',
    text: 'Les néons tremblent au bord du quai\nLa nuit s’étire, rien n’est pressé\nJe garde la cadence et le pied sur le temps\nUne corde qui sonne, un peu de vent',
  }),
  example({
    id: 'i4', kind: 'memo', title: 'Idée de pont, fredonnée', created: now - 3 * DAY, key: 4, minor: true, bpm: 76, style: 'Rock', mood: 'Sombre',
    lick: [64, 67, 69, 71, 69, 67, 64, 62, 64, 64, 67, 64],
  }),
  example({
    id: 'i5', kind: 'riff', title: 'Funk en Mi m, 16e', created: now - 5 * DAY, key: 4, minor: true, bpm: 104, style: 'Funk', mood: 'Groovy',
    lick: [52, 52, 64, 52, 62, 52, 64, 67, 52, 52, 64, 52, 62, 64, 59, 62],
  }),
  example({
    id: 'i6', kind: 'riff', title: 'Intro rock en Ré', created: now - 9 * DAY, key: 2, bpm: 128, style: 'Rock', mood: 'Énergique',
    lick: [50, 50, 57, 50, 60, 50, 57, 55, 50, 50, 57, 50, 62, 60, 57, 55],
  }),
];

export function relativeDay(t: number): string {
  const startOf = (d: number) => new Date(d).setHours(0, 0, 0, 0);
  const days = Math.round((startOf(Date.now()) - startOf(t)) / DAY);
  if (days <= 0) return 'aujourd’hui';
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} j`;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(t);
}

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
