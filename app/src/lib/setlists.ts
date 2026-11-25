import { SONG } from './data';
import { gridBars, gridChordPro, gridForSong, gridSongId, grooveDef, readGrids, type Grid } from './grids';
import { KEY_FR, mod12 } from './music';
import { readStored, writeStored } from './store';

export interface Song {
  id: string; title: string; key: number; minor?: boolean; bpm: number; feel: string; capo: number;
  /** Artist or subtitle, from an imported ChordPro file. */
  artist?: string;
  /** Seconds. */
  duration: number;
  /** ChordPro source, when lyrics and chords exist. */
  chordpro?: string;
  /** True when `chordpro` is a chord chart generated from a grid (no lyrics). */
  fromGrid?: boolean;
  /** Lowest and highest sung notes (MIDI), to find the singer's key. */
  melodyLow?: number;
  melodyHigh?: number;
}

export interface CheckItem { id: string; text: string; done: boolean }
export interface Setlist {
  id: string; name: string;
  /** Concert sheet: a memo per song for this set (tuning, capo, sound, who starts…). */
  memos?: Record<string, string>;
  /** Seconds between two songs (tuning, a word to the audience). */
  gap?: number;
  /** « Avant de monter sur scène ». */
  checklist?: CheckItem[];
  /** Date and time of the gig; none for a set that is not tied to a date. */
  date?: number;
  songIds: string[];
}

/** Example songs on first launch (invented titles; only Minuit Shuffle has lyrics). Editable afterwards. */
export const INITIAL_SONGS: Song[] = [
  { id: 's1', title: 'Réveil électrique', key: 4, bpm: 128, feel: 'rock', capo: 0, duration: 200 },
  { id: 's2', title: 'Café noir', key: 2, minor: true, bpm: 98, feel: 'funk', capo: 0, duration: 245, melodyLow: 50, melodyHigh: 62 },
  { id: 's3', title: 'Minuit Shuffle', key: 9, bpm: 92, feel: 'shuffle', capo: 0, duration: 250, chordpro: SONG, melodyLow: 55, melodyHigh: 64 },
  { id: 's4', title: 'Rouille et chrome', key: 7, bpm: 110, feel: 'rock', capo: 0, duration: 225 },
  { id: 's5', title: 'Le train de 6 h 12', key: 4, bpm: 104, feel: 'shuffle', capo: 0, duration: 235 },
  { id: 's6', title: 'Bayou sec', key: 0, bpm: 84, feel: 'blues lent', capo: 0, duration: 330 },
  { id: 's7', title: 'Talons hauts', key: 4, minor: true, bpm: 106, feel: 'funk 16e', capo: 0, duration: 220 },
  { id: 's8', title: 'Néons du quai', key: 11, minor: true, bpm: 72, feel: 'ballade', capo: 2, duration: 260, melodyLow: 59, melodyHigh: 74 },
  { id: 's9', title: 'Dernier verre', key: 9, bpm: 140, feel: 'rock', capo: 0, duration: 175 },
  { id: 's10', title: 'Poussière d’août', key: 2, bpm: 96, feel: 'shuffle', capo: 0, duration: 240 },
  { id: 's11', title: 'Ligne blanche', key: 7, bpm: 118, feel: 'rock', capo: 0, duration: 210 },
];

const GRID_SONG_SECONDS = 210;

/** A grid that is not a catalog song becomes a song of its own. */
function gridSong(g: Grid): Song {
  return {
    id: gridSongId(g), title: g.title, key: g.key, bpm: g.bpm, feel: grooveDef(g.groove).label.toLowerCase(), capo: 0,
    // A grid holds the form, not the arrangement: count a typical song length, at least one full pass.
    duration: Math.max(GRID_SONG_SECONDS, Math.round((gridBars(g) * 4 * 60) / g.bpm)), chordpro: gridChordPro(g), fromGrid: true,
  };
}

/** Catalog songs and grid songs. A catalog song without lyrics shows its grid's chords on stage. */
export const readSongs = () => readStored<Song[]>('songs', INITIAL_SONGS);

export function songById(id: string): Song | undefined {
  const s = readSongs().find(x => x.id === id);
  const g = gridForSong(id);
  if (s) return s.chordpro || !g ? s : { ...s, chordpro: gridChordPro(g), fromGrid: true };
  return g ? gridSong(g) : undefined;
}

/** Everything that can be added to a setlist. */
export const allSongs = (): Song[] => [...readSongs(), ...readGrids().filter(g => !g.songId).map(gridSong)];

/** True when the ChordPro text has words, not only chords and section labels. */
export const hasLyrics = (src?: string) =>
  !!src && src.split('\n').some(l => !/^\{.*\}$/.test(l.trim()) && l.replace(/\[[^\]]*\]/g, '').trim().length > 0);

/**
 * A grid that is its own song ("g:<id>") gets a real song record the first time it is edited:
 * same id each time (idempotent), the grid points to it and setlists follow.
 */
export function materializeGridSong(songId: string): string {
  if (!songId.startsWith('g:')) return songId;
  const gridId = songId.slice(2);
  const newId = `song-${gridId}`;
  const songs = readSongs();
  if (!songs.some(s => s.id === newId)) {
    const g = readGrids().find(x => x.id === gridId);
    if (!g) return songId;
    const base = gridSong(g);
    // Empty text: until lyrics are written, the stage keeps showing the grid's chords.
    writeStored('songs', [...songs, { ...base, id: newId, chordpro: '', fromGrid: undefined }]);
  }
  writeStored('grids', readGrids().map(x => (x.id === gridId ? { ...x, songId: newId } : x)));
  writeStored('setlists', readStored<Setlist[]>('setlists', INITIAL_SETLISTS).map(s => ({ ...s, songIds: s.songIds.map(x => (x === songId ? newId : x)) })));
  return newId;
}

/** Chords of a key to insert quickly: diatonic triads plus the dominant seventh. */
export function keyChords(key: number, minor?: boolean): string[] {
  const flats = [5, 10, 3, 8, 1].includes(minor ? mod12(key + 3) : key);
  const N = flats ? ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] : ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const n = (iv: number, q = '') => N[mod12(key + iv)] + q;
  return minor
    ? [n(0, 'm'), n(3), n(5, 'm'), n(7, 'm'), n(8), n(10), n(7, '7')]
    : [n(0), n(2, 'm'), n(4, 'm'), n(5), n(7), n(9, 'm'), n(7, '7')];
}

export const FEELS = ['shuffle', 'rock', 'funk', 'funk 16e', 'blues lent', 'ballade', 'pop', 'reggae', 'autre'];
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

/* ---------- Concert sheet ---------- */

export const DEFAULT_GAP = 30;
export const GAPS = [0, 15, 30, 45, 60, 90, 120];
export const DEFAULT_CHECKLIST = [
  'Accorder toutes les guitares', 'Cordes et médiators de rechange', 'Câbles, piles, alimentations',
  'Tablette chargée, veille désactivée', 'Pédalier Bluetooth connecté', 'De l’eau',
];
export const checklistOf = (s: Setlist): CheckItem[] =>
  s.checklist ?? DEFAULT_CHECKLIST.map((text, i) => ({ id: 'c' + i, text, done: false }));

/** When each song starts, in seconds from the beginning of the set (with the gaps), and the set's length. */
export function setTimeline(durations: number[], gap: number): { starts: number[]; total: number } {
  const starts: number[] = [];
  let t = 0;
  durations.forEach((d, i) => { starts.push(t); t += d + (i < durations.length - 1 ? gap : 0); });
  return { starts, total: t };
}
export const fmtClock = (t: number) => new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(t);
export const fmtMin = (sec: number) => `${Math.round(sec / 60)} min`;
export const fmtDur = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
export function fmtDate(t: number) {
  const s = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(t);
  const h = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(t);
  return `${s.charAt(0).toUpperCase() + s.slice(1)} · ${h}`;
}
/** Sets in order: dated ones by date, then undated ones as created. */
export const sortSets = (list: Setlist[]) =>
  list.map((s, i) => ({ s, i })).sort((a, b) => (a.s.date ?? Infinity) - (b.s.date ?? Infinity) || a.i - b.i).map(x => x.s);
/** The next gig to come (a dated set from today on). */
export const nextSet = (list: Setlist[]) => sortSets(list).find(s => s.date !== undefined && s.date >= Date.now());
export const setDateLabel = (s: Setlist) => (s.date !== undefined ? fmtDate(s.date) : 'Sans date');
/** For a datetime-local input (local time). */
export const toLocalInput = (t: number) => { const d = new Date(t - new Date(t).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };
export const titlesLabel = (n: number) => `${n} titre${n > 1 ? 's' : ''}`;
