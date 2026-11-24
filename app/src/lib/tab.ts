/**
 * Riffs written as tablature in the notebook: columns of six strings (index 0 = low E … 5 = high
 * e), a fret number, -1 for a muted note (×), or null. Pure, no browser.
 */
import { OPEN_MIDI } from './chords';

export type TabCell = number | null;
export interface Tab { cols: TabCell[][] }
export const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
export const STRING_FR = ['Mi grave', 'La', 'Ré', 'Sol', 'Si', 'Mi aigu'];
export const MAX_FRET = 24;
export const MAX_COLS = 128;

export const emptyTab = (n = 16): Tab => ({ cols: Array.from({ length: n }, () => Array<TabCell>(6).fill(null)) });
export const isEmptyTab = (t: Tab | undefined) => !t || t.cols.every(c => c.every(x => x === null));

/** A copy with one cell changed (fret, -1 for ×, null to clear). */
export function setCell(t: Tab, col: number, string: number, v: TabCell): Tab {
  const cols = t.cols.map((c, i) => (i === col ? c.map((x, s) => (s === string ? v : x)) : c));
  return { cols };
}
export const addCols = (t: Tab, n = 8): Tab => ({ cols: [...t.cols, ...emptyTab(n).cols].slice(0, MAX_COLS) });
/** Empty columns at the end removed (at least one kept). */
export function trimTab(t: Tab): Tab {
  let end = t.cols.length;
  while (end > 1 && t.cols[end - 1].every(x => x === null)) end--;
  return { cols: t.cols.slice(0, end) };
}

/** The tab as text, high e on top (« e|--5--7--| »), to copy or share. */
export function tabToText(t: Tab): string {
  const cols = trimTab(t).cols;
  const w = cols.map(c => Math.max(1, ...c.map(x => (x === null ? 1 : x === -1 ? 1 : String(x).length))));
  return [5, 4, 3, 2, 1, 0].map(s =>
    `${STRING_NAMES[s]}|-${cols.map((c, i) => { const x = c[s]; const v = x === null ? '' : x === -1 ? 'x' : String(x); return v.padEnd(w[i], '-'); }).join('--')}-|`,
  ).join('\n');
}

/** The notes of each column (MIDI), low to high; muted notes are not played. */
export const tabNotes = (t: Tab): number[][] =>
  trimTab(t).cols.map(c => c.flatMap((x, s) => (x !== null && x >= 0 ? [OPEN_MIDI[s] + x] : [])));
