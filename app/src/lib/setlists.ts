import { SONG } from './data';
import { KEY_FR } from './music';

export interface Song {
  id: string; title: string; key: number; minor?: boolean; bpm: number; feel: string; capo: number;
  /** Seconds. */
  duration: number;
  /** ChordPro source, when lyrics and chords exist. */
  chordpro?: string;
}

export interface Setlist { id: string; name: string; date: number; songIds: string[] }

/** Song catalog for the mock-up (invented titles; only Minuit Shuffle has lyrics). */
export const SONGS: Song[] = [
  { id: 's1', title: 'Réveil électrique', key: 4, bpm: 128, feel: 'rock', capo: 0, duration: 200 },
  { id: 's2', title: 'Café noir', key: 2, minor: true, bpm: 98, feel: 'funk', capo: 0, duration: 245 },
  { id: 's3', title: 'Minuit Shuffle', key: 9, bpm: 92, feel: 'shuffle', capo: 0, duration: 250, chordpro: SONG },
  { id: 's4', title: 'Rouille et chrome', key: 7, bpm: 110, feel: 'rock', capo: 0, duration: 225 },
  { id: 's5', title: 'Le train de 6 h 12', key: 4, bpm: 104, feel: 'shuffle', capo: 0, duration: 235 },
  { id: 's6', title: 'Bayou sec', key: 0, bpm: 84, feel: 'blues lent', capo: 0, duration: 330 },
  { id: 's7', title: 'Talons hauts', key: 4, minor: true, bpm: 106, feel: 'funk 16e', capo: 0, duration: 220 },
  { id: 's8', title: 'Néons du quai', key: 11, minor: true, bpm: 72, feel: 'ballade', capo: 2, duration: 260 },
  { id: 's9', title: 'Dernier verre', key: 9, bpm: 140, feel: 'rock', capo: 0, duration: 175 },
  { id: 's10', title: 'Poussière d’août', key: 2, bpm: 96, feel: 'shuffle', capo: 0, duration: 240 },
  { id: 's11', title: 'Ligne blanche', key: 7, bpm: 118, feel: 'rock', capo: 0, duration: 210 },
];

export const songById = (id: string) => SONGS.find(s => s.id === id);
export const songKey = (s: Song, trans = 0) => KEY_FR[(((s.key + trans) % 12) + 12) % 12] + (s.minor ? ' m' : '');
export const songMeta = (s: Song) => `${songKey(s)} · ${s.bpm} BPM · ${s.feel}`;

const DAY = 86400000;
const at = (days: number, hour: number) => { const d = new Date(Date.now() + days * DAY); d.setHours(hour, 0, 0, 0); return d.getTime(); };

export const INITIAL_SETLISTS: Setlist[] = [
  { id: 'bar-du-port', name: 'Bar du Port', date: at(8, 21), songIds: ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9'] },
  { id: 'repet-jeudi', name: 'Répét’ jeudi', date: at(3, 19), songIds: ['s3', 's10', 's11', 's7', 's6'] },
  { id: 'fete-musique', name: 'Fête de la musique', date: at(40, 18), songIds: ['s9', 's3', 's5', 's2', 's11', 's1'] },
];

export const setDuration = (s: Setlist) => s.songIds.reduce((t, id) => t + (songById(id)?.duration ?? 0), 0);
export const fmtMin = (sec: number) => `${Math.round(sec / 60)} min`;
export const fmtDur = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
export function fmtDate(t: number) {
  const s = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(t);
  const h = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(t);
  return `${s.charAt(0).toUpperCase() + s.slice(1)} · ${h}`;
}
export const titlesLabel = (n: number) => `${n} titre${n > 1 ? 's' : ''}`;
