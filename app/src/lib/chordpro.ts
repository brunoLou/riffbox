/**
 * ChordPro files (.cho, .chopro, .chordpro, .crd, .pro): the common format of songbook apps.
 * The app keeps a small dialect of it ([chords] in the text, {c:Section} labels), so importing
 * maps the usual directives onto that dialect, and exporting writes standard ChordPro.
 */
import { LETTERS } from './chords';
import { mod12 } from './music';
import type { Song } from './setlists';

/** What an imported file gives: a song without an id yet. */
export type ImportedSong = Omit<Song, 'id'>;

export const CHORDPRO_EXT = ['.cho', '.chopro', '.chordpro', '.crd', '.pro', '.txt'];
export const DEFAULTS = { key: 9, bpm: 90, feel: 'shuffle', capo: 0, duration: 210 };

/* ---------- Keys ---------- */

const EN: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11, H: 11 };
const FR: [RegExp, number][] = [[/^do/i, 0], [/^ré|^re/i, 2], [/^mi/i, 4], [/^fa/i, 5], [/^sol/i, 7], [/^la/i, 9], [/^si/i, 11]];

/** "Am", "F#", "Bb", "Do♯ m", "Si bémol mineur", "La" → pitch class and mode. */
export function parseKey(raw: string): { key: number; minor: boolean } | null {
  const s = raw.trim();
  if (!s) return null;
  let pc: number | undefined, rest = '';
  const fr = FR.find(([re]) => re.test(s));
  if (fr) {
    pc = fr[1];
    rest = s.replace(fr[0], '');
  } else if (EN[s[0].toUpperCase()] !== undefined) {
    pc = EN[s[0].toUpperCase()];
    rest = s.slice(1);
  }
  if (pc === undefined) return null;
  rest = rest.trim();
  const acc = rest.match(/^(dièse|diese|bémol|bemol|#|♯|b|♭)\s*/i);
  if (acc) {
    pc += /^(#|♯|di)/i.test(acc[1]) ? 1 : -1;
    rest = rest.slice(acc[0].length);
  }
  // "m", "min", "mineur", "-" are minor; "maj", "majeur" are not.
  const minor = /^(m(?!aj)|min|mineur|-)/i.test(rest.trim());
  return { key: mod12(pc), minor };
}

/** "Am", "F#", "Bb" — the spelling most songbook apps read. */
export const keyName = (key: number, minor?: boolean) => LETTERS[mod12(key)] + (minor ? 'm' : '');

/* ---------- Import ---------- */

const SECTION_START: Record<string, string> = {
  soc: 'Refrain', start_of_chorus: 'Refrain', sov: 'Couplet', start_of_verse: 'Couplet',
  sob: 'Pont', start_of_bridge: 'Pont', sot: 'Tablature', start_of_tab: 'Tablature',
  sog: 'Grille', start_of_grid: 'Grille',
};
const COMMENTS = new Set(['c', 'comment', 'ci', 'comment_italic', 'cb', 'comment_box', 'highlight']);

/** "4:10", "250", "4 min 10" → seconds. */
function parseDuration(v: string): number | undefined {
  const m = v.match(/^(\d+):(\d{1,2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

/** A directive line: {name}, {name: value} or {name label="value"} (ChordPro 6). */
function directive(line: string): { name: string; value: string } | null {
  const m = line.trim().match(/^\{\s*([a-zA-Z_]+[a-zA-Z0-9_-]*)\s*(?::\s*([\s\S]*?))?\s*\}$/);
  if (m) {
    const value = (m[2] ?? '').trim();
    const name = m[1].toLowerCase();
    return { name, value };
  }
  const attr = line.trim().match(/^\{\s*([a-zA-Z_]+)\s+label\s*=\s*"([^"]*)"\s*\}$/);
  return attr ? { name: attr[1].toLowerCase(), value: attr[2] } : null;
}

/** Split a file on {new_song} / {ns}. */
function splitSongs(text: string): string[] {
  const parts: string[][] = [[]];
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const d = directive(line);
    if (d && (d.name === 'new_song' || d.name === 'ns')) parts.push([]);
    else parts[parts.length - 1].push(line);
  }
  return parts.map(p => p.join('\n')).filter(p => p.trim());
}

function importOne(src: string, fallbackTitle: string): ImportedSong {
  const meta: Record<string, string> = {};
  const body: string[] = [];
  for (const line of src.split('\n')) {
    if (/^\s*#/.test(line)) continue; // ChordPro comment line
    const d = directive(line);
    if (!d) { body.push(line.replace(/\s+$/, '')); continue; }
    const { name, value } = d;
    if (['title', 't'].includes(name)) meta.title ??= value;
    else if (['subtitle', 'st', 'artist'].includes(name)) meta.artist ??= value;
    else if (['key', 'tempo', 'capo', 'duration', 'x_riffbox_feel', 'x_feel', 'x_riffbox_melody'].includes(name)) meta[name] ??= value;
    else if (COMMENTS.has(name)) { if (value) body.push(`{c:${value}}`); }
    else if (SECTION_START[name]) body.push(`{c:${value || SECTION_START[name]}}`);
    else if (name.startsWith('start_of_')) body.push(`{c:${value || name.slice(9).replace(/_/g, ' ')}}`);
    else if (name.startsWith('end_of_') || ['eoc', 'eov', 'eob', 'eot', 'eog'].includes(name)) body.push('');
    else if (name === 'chorus') body.push(`{c:${value || 'Refrain'}}`);
    // Anything else (fonts, page breaks, chord definitions…) does not apply here.
  }

  // Tidy blank lines: none at the ends, at most one in a row.
  const lines = body.reduce<string[]>((out, l) => (l === '' && (out.length === 0 || out[out.length - 1] === '') ? out : [...out, l]), []);
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  const chordpro = lines.join('\n');

  const firstChord = chordpro.match(/\[([A-H][#b♯♭]?m?(?!aj))/);
  const k = (meta.key && parseKey(meta.key)) || (firstChord && parseKey(firstChord[1])) || null;
  const bpm = Math.round(Number(meta.tempo));
  const capo = Math.round(Number(meta.capo));
  const melody = meta.x_riffbox_melody?.match(/^(\d+)\D+(\d+)$/);

  const song: ImportedSong = {
    title: (meta.title || fallbackTitle || 'Morceau importé').slice(0, 80),
    key: k?.key ?? DEFAULTS.key,
    minor: k?.minor || undefined,
    bpm: bpm >= 30 && bpm <= 300 ? bpm : DEFAULTS.bpm,
    feel: meta.x_riffbox_feel || meta.x_feel || DEFAULTS.feel,
    capo: capo >= 0 && capo <= 12 ? capo : DEFAULTS.capo,
    duration: (meta.duration && parseDuration(meta.duration)) || DEFAULTS.duration,
    chordpro,
  };
  if (meta.artist) song.artist = meta.artist.slice(0, 80);
  if (melody) { song.melodyLow = Number(melody[1]); song.melodyHigh = Number(melody[2]); }
  return song;
}

/** Every song in a ChordPro file (several when it uses {new_song}). */
export function importChordPro(text: string, fileName = ''): ImportedSong[] {
  const fallback = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  const parts = splitSongs(text);
  return parts.map((p, i) => importOne(p, parts.length > 1 && fallback ? `${fallback} ${i + 1}` : fallback));
}

/* ---------- Export ---------- */

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** One song as standard ChordPro. Section labels are {c:…} comments, which every app shows. */
export function exportChordPro(s: Song): string {
  const head = [
    `{title: ${s.title}}`,
    s.artist ? `{artist: ${s.artist}}` : null,
    `{key: ${keyName(s.key, s.minor)}}`,
    `{tempo: ${s.bpm}}`,
    s.capo ? `{capo: ${s.capo}}` : null,
    `{duration: ${mmss(s.duration)}}`,
    `{x_riffbox_feel: ${s.feel}}`,
    s.melodyLow != null && s.melodyHigh != null ? `{x_riffbox_melody: ${s.melodyLow} ${s.melodyHigh}}` : null,
  ].filter(Boolean);
  const body = (s.chordpro ?? '').replace(/\s+$/, '');
  return head.join('\n') + '\n' + (body ? '\n' + body + '\n' : '');
}

/** Several songs in one file, separated by {new_song}. */
export const exportSongbook = (songs: Song[]) => songs.map(exportChordPro).join('\n{new_song}\n');

/** "Café noir" → "cafe-noir.cho" */
export const chordProFileName = (title: string) =>
  (title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'morceau') + '.cho';
