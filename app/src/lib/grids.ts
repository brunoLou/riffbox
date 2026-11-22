import { GRID_INITIAL } from './data';
import { chordName, type Chord } from './music';
import { readStored } from './store';

export type GridGroove = 'shuffle' | 'rock' | 'funk';
export const GRID_GROOVES: { id: GridGroove; label: string; style: string }[] = [
  { id: 'shuffle', label: 'Shuffle', style: 'Blues' },
  { id: 'rock', label: 'Rock', style: 'Rock' },
  { id: 'funk', label: 'Funk', style: 'Funk' },
];
export const GRID_SECTIONS = ['Couplet', 'Refrain', 'Pont'];
export const GRID_MAX_CHORDS = 8;
export const GRID_BPM = { min: 40, max: 220 };

export interface Grid {
  id: string;
  title: string;
  /** Major key shown at the centre of the circle of fifths (pitch class). */
  key: number;
  bpm: number;
  groove: GridGroove;
  /** One chord list per section (Couplet, Refrain, Pont). */
  prog: Chord[][];
  created: number;
  /** Riff from the notebook this grid was built from. */
  ideaId?: string;
  /** Style it was generated in (« Une autre » makes sections again in this style). */
  style?: import('./generate').GenStyle;
  /** Catalog song this grid belongs to; otherwise the grid is its own song ("g:<id>"). */
  songId?: string;
}

const m = (pc: number): Chord => ({ pc, m: true });
const M = (pc: number): Chord => ({ pc });
const DAY = 86400000;

/** Example grids (invented); Minuit Shuffle is linked to the example riff and to its song with lyrics. */
export const INITIAL_GRIDS: Grid[] = [
  { id: 'g-minuit', title: 'Minuit Shuffle', key: 9, bpm: 92, groove: 'shuffle', prog: GRID_INITIAL, created: Date.now() - DAY, ideaId: 'i1', songId: 's3' },
  { id: 'g-cafe', title: 'Café noir', key: 5, bpm: 98, groove: 'funk', created: Date.now() - 4 * DAY, songId: 's2',
    prog: [[m(2), m(7), m(2), m(9)], [M(10), M(0), m(2), m(2)], [m(7), M(10), M(0), m(9)]] },
  { id: 'g-reveil', title: 'Réveil électrique', key: 4, bpm: 128, groove: 'rock', created: Date.now() - 6 * DAY, songId: 's1',
    prog: [[M(4), M(2), M(9), M(4)], [M(9), M(4), M(11), M(4)], [m(1), M(9), M(11), M(11)]] },
];

export const readGrids = () => readStored<Grid[]>('grids', INITIAL_GRIDS);
export const grooveDef = (g: GridGroove) => GRID_GROOVES.find(x => x.id === g)!;

/** Song id used in setlists for this grid. */
export const gridSongId = (g: Grid) => g.songId ?? `g:${g.id}`;
export const gridForSong = (songId: string) =>
  readGrids().find(g => gridSongId(g) === songId);

/** Bars in one pass of the grid (each section played twice). */
export const gridBars = (g: Grid) => g.prog.reduce((t, p) => t + p.length, 0) * 2;

/** The grid as a ChordPro chord chart (chords only), for the prompter. */
export function gridChordPro(g: Grid): string {
  return g.prog
    .map((chords, i) => (chords.length ? `{c:${GRID_SECTIONS[i]}}\n` + chunk(chords, 4).map(l => l.map(c => `[${chordName(c)}]`).join('')).join('\n') : ''))
    .filter(Boolean)
    .join('\n');
}
const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

export const firstChords = (g: Grid) => (g.prog.find(p => p.length) ?? []).map(chordName);
