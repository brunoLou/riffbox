/**
 * Chord sheets as people write them (chords on a line above the lyrics, from a PDF or pasted from
 * a website) turned into the app's ChordPro: each chord placed in the lyric where it sits above it.
 * Pure logic: lines come with the horizontal position of each character (columns for plain text,
 * points for a PDF), so proportional fonts align too.
 */
import { parseChordName } from './chordDetect';
import { rankKeys } from './keyDetect';

export interface SheetLine {
  text: string;
  /** Horizontal position of each character of `text`. */
  xs: number[];
  /** Font size (PDF), to find titles. */
  size?: number;
  /** A gap above this line large enough to be a blank line (PDF). */
  gapBefore?: boolean;
  page?: number;
}

/* ---------- Chords ---------- */

const ACC = '(?:#|b|♯|♭)?';
const QUAL = '(?:m(?!aj)|min|-)?(?:maj7?|M7|Δ7?|dim7?|°7?|ø7?|aug|\\+|sus[24]?|add\\d{1,2}|\\d{1,2}|[b#♭♯](?:5|9|11|13)|alt|\\(\\S+?\\))*';
const EN = new RegExp(`^([A-H])(${ACC})(${QUAL})(?:/([A-H])(${ACC}))?$`);
const FR_ROOT = '(Do|Ré|Re|Mi|Fa|Sol|La|Si)';
const FR = new RegExp(`^${FR_ROOT}(${ACC})(${QUAL})(?:/${FR_ROOT}(${ACC}))?$`);
const FR_TO_EN: Record<string, string> = { Do: 'C', Ré: 'D', Re: 'D', Mi: 'E', Fa: 'F', Sol: 'G', La: 'A', Si: 'B' };
const acc = (a: string) => a.replace('♯', '#').replace('♭', 'b');

/** A chord name in English letters (« Lam7 » → « Am7 », « Sol/Si » → « G/B »), or null if not a chord. */
export function chordToken(tok: string): string | null {
  // « (G) » is G; « A(add9) » keeps its parenthesis.
  const t = /^\(.*\)$/.test(tok) ? tok.slice(1, -1) : tok;
  let m = t.match(EN);
  if (m) {
    const root = m[1] === 'H' ? 'B' : m[1];
    return root + acc(m[2]) + m[3].replace(/^min|^-/, 'm') + (m[4] ? '/' + (m[4] === 'H' ? 'B' : m[4]) + acc(m[5]) : '');
  }
  m = t.match(FR);
  if (m) return FR_TO_EN[m[1]] + acc(m[2]) + m[3].replace(/^min|^-/, 'm') + (m[4] ? '/' + FR_TO_EN[m[4]] + acc(m[5]) : '');
  return null;
}
/** Marks that may stand between chords on a chord line (bars, repeats, « no chord »). */
const FILLER = /^(\||\|\||:?\|:?|\/|%|-+|\*|x\d+|\(x\d+\)|×\d+|\(×\d+\)|N\.?C\.?|\.{2,})$/i;

/** Words of a line with the position of their first character. */
function tokens(l: SheetLine): { t: string; x: number }[] {
  const out: { t: string; x: number }[] = [];
  for (let m, re = /\S+/g; (m = re.exec(l.text));) out.push({ t: m[0], x: l.xs[m.index] ?? m.index });
  return out;
}
/** A line made only of chords (and bar or repeat marks), with at least one chord. */
export function isChordLine(l: SheetLine): boolean {
  const ts = tokens(l);
  return ts.length > 0 && ts.some(t => chordToken(t.t)) && ts.every(t => chordToken(t.t) || FILLER.test(t.t));
}

/* ---------- Other kinds of lines ---------- */

const SECTIONS = 'intro|couplet|refrain|chorus|verse|pont|bridge|pr[ée]-?refrain|pre-?chorus|outro|solo|instrumental|interlude|coda|final|fin|break|riff|tag|post-?chorus';
/** After the name, only a number, a repeat or « bis » / « final »: « Refrain de ma vie » is a lyric. */
const SUFFIX = '(?:\\s*(?:\\d+|[x×]\\d+|\\(?(?:bis|x\\d+|×\\d+)\\)?|final|finale))*';
const SECTION = new RegExp(`^\\s*[\\[(]?\\s*((?:${SECTIONS})\\b${SUFFIX})\\s*[\\])]?\\s*:?\\s*$`, 'i');
/** « [Verse 1] », « Refrain : », « (Pont) » → the section's label. */
export function sectionLabel(text: string): string | null {
  const m = text.match(SECTION);
  if (!m) return null;
  const l = m[1].trim().replace(/\s+/g, ' ');
  return l.charAt(0).toUpperCase() + l.slice(1);
}
/** Guitar tablature lines (e|--3--|) and rules (-----). */
const TAB = /^\s*([eBGDAEbgda]\s*[|:]\s*[-\d|hpbr/\\~x ()]{4,}|[-=_~]{4,})\s*$/;
const META: [RegExp, string][] = [
  [/^\s*capo\s*[:\-]?\s*(\d{1,2})\b/i, 'capo'],
  [/^\s*(?:key|tonalit[ée]|ton)\s*[:\-]\s*(\S+)/i, 'key'],
  [/^\s*(?:tempo|bpm)\s*[:\-]?\s*(\d{2,3})\b/i, 'tempo'],
  [/^\s*(?:artist|artiste|interpr[èe]te|auteur)\s*[:\-]\s*(.+)$/i, 'artist'],
  [/^\s*(?:title|titre)\s*[:\-]\s*(.+)$/i, 'title'],
];
function metaOf(text: string): [string, string] | null {
  for (const [re, name] of META) { const m = text.match(re); if (m) return [name, m[1].trim()]; }
  return null;
}

/* ---------- Placing chords in the lyric ---------- */

/** The lyric with each chord of the line above inserted where it sits (by horizontal position). */
export function mergeChords(chords: SheetLine, lyric: SheetLine, tolerance: number): string {
  const cs = tokens(chords).map(t => ({ c: chordToken(t.t), x: t.x })).filter((t): t is { c: string; x: number } => !!t.c);
  const text = lyric.text.replace(/\s+$/, '');
  const xs = lyric.xs.slice(0, text.length);
  const at = cs.map(({ c, x }) => {
    let i = xs.findIndex(v => v >= x - tolerance);
    if (i < 0) return { c, i: text.length };
    // Above a space: the chord belongs to the word that follows.
    while (i < text.length && text[i] === ' ') i++;
    return { c, i };
  });
  let out = '';
  for (let k = 0; k <= text.length; k++) {
    const here = at.filter(a => a.i === k).map(a => `[${a.c}]`).join('');
    // Chords past the end of the lyric follow it, after a space.
    out += (k === text.length && here && text ? ' ' : '') + here + (text[k] ?? '');
  }
  return out;
}
/** A line of chords alone (an intro, a riff): its chords, and its repeat marks (x2) as text. */
const chordsOnly = (l: SheetLine) => tokens(l)
  .map(t => { const c = chordToken(t.t); return c ? `[${c}]` : /^\(?[x×]\d+\)?$/i.test(t.t) ? t.t : ''; })
  .filter(Boolean).join(' ');

/* ---------- Whole sheets ---------- */

/** Most likely key from the chords of a song (major/minor), as ChordPro writes it (« G », « Em »). */
export function keyFromChords(chordpro: string): string | null {
  const ch = new Array(12).fill(0);
  let n = 0;
  for (const m of chordpro.matchAll(/\[([^\]]+)\]/g)) {
    const s = parseChordName(m[1]);
    if (!s) continue;
    n++;
    s.pcs.forEach(p => (ch[p] += p === s.root ? 2 : 1));
    ch[s.bass] += 1;
  }
  if (!n) return null;
  // The first and last chords usually are the tonic: a little extra weight.
  const ends = [...chordpro.matchAll(/\[([^\]]+)\]/g)].map(m => parseChordName(m[1])).filter(Boolean);
  if (ends.length) { ch[ends[0]!.root] += 2; ch[ends[ends.length - 1]!.root] += 2; }
  const best = rankKeys(ch)[0];
  if (!best) return null;
  const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  return NAMES[best.key] + (best.minor ? 'm' : '');
}

export interface SheetOptions {
  /** How far a chord may sit left of the letter it belongs to (half a column for text). */
  tolerance: number;
  /** A title for a song that has none (file name). */
  fallbackTitle?: string;
}

/**
 * Lines of one or several chord sheets → ChordPro text ({title}, {artist}, {key}, {capo}, {tempo},
 * {c:Section}, [chords] in the lyrics, {new_song} between songs), for the ChordPro import.
 * A new song starts at each title line (`isTitle`).
 */
export function sheetToChordPro(lines: SheetLine[], opts: SheetOptions, isTitle: (l: SheetLine, i: number) => boolean = (_, i) => i === 0): string {
  const songs: { meta: Record<string, string>; body: string[] }[] = [];
  let cur: { meta: Record<string, string>; body: string[] } | null = null;
  const start = () => { cur = { meta: {}, body: [] }; songs.push(cur); return cur; };
  const blank = (s: { body: string[] }) => { if (s.body.length && s.body[s.body.length - 1] !== '') s.body.push(''); };

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const text = l.text.trim();
    let s = cur ?? start();
    if (l.gapBefore) blank(s);
    if (!text) { blank(s); continue; }
    if (TAB.test(l.text)) continue;
    const chordLine = isChordLine(l);
    if (!chordLine && !sectionLabel(text) && isTitle(l, i)) {
      if (s.meta.title || s.body.some(b => b)) s = start();
      // « Titre - Artiste » on one line.
      const parts = text.split(/\s+[-–—]\s+/);
      s.meta.title = parts[0];
      if (parts[1] && !s.meta.artist) s.meta.artist = parts.slice(1).join(' - ');
      continue;
    }
    const meta = chordLine ? null : metaOf(text);
    if (meta) { if (!s.meta[meta[0]]) s.meta[meta[0]] = meta[1]; continue; }
    const sec = chordLine ? null : sectionLabel(text);
    if (sec) { blank(s); s.body.push(`{c:${sec}}`); continue; }
    if (chordLine) {
      const next = lines[i + 1];
      const nextText = next?.text.trim() ?? '';
      const lyricNext = next && nextText && !next.gapBefore && !isChordLine(next) && !sectionLabel(nextText) && !metaOf(nextText) && !TAB.test(next.text);
      if (lyricNext) { s.body.push(mergeChords(l, next!, opts.tolerance)); i++; }
      else s.body.push(chordsOnly(l));
      continue;
    }
    s.body.push(text);
  }

  return songs
    .filter(s => s.body.some(b => b.trim()))
    .map((s, k) => {
      const body = s.body.join('\n').replace(/^\n+|\n+$/g, '');
      const key = s.meta.key ?? keyFromChords(body);
      const head = [
        `{title: ${s.meta.title ?? (opts.fallbackTitle ? opts.fallbackTitle + (songs.length > 1 ? ` ${k + 1}` : '') : 'Morceau importé')}}`,
        s.meta.artist && `{artist: ${s.meta.artist}}`,
        key && `{key: ${chordToken(key) ?? key}}`,
        s.meta.capo && `{capo: ${s.meta.capo}}`,
        s.meta.tempo && `{tempo: ${s.meta.tempo}}`,
      ].filter(Boolean);
      return [...head, body].join('\n');
    })
    .join('\n{new_song}\n');
}

/* ---------- Plain text ---------- */

/** Text lines with their columns (tabs expanded to 8). */
export function textLines(text: string): SheetLine[] {
  return text.replace(/\r\n?/g, '\n').split('\n').map(raw => {
    let t = '';
    for (const ch of raw) t += ch === '\t' ? ' '.repeat(8 - (t.length % 8)) : ch;
    return { text: t.replace(/\s+$/, ''), xs: Array.from(t, (_, i) => i) };
  });
}

/** Already ChordPro: directives, or chords in brackets inside lyrics. */
export function looksLikeChordPro(text: string): boolean {
  if (/^\s*\{\s*[a-z_]+\s*[:}]/im.test(text)) return true;
  return text.split('\n').some(line => {
    const brackets = [...line.matchAll(/\[([^\]\n]{1,12})\]/g)];
    return brackets.some(b => chordToken(b[1])) && line.replace(/\[[^\]]*\]/g, '').trim().length > 0;
  });
}

/** Pasted text → ChordPro: the title is its first line (unless it is chords, a section or a field). */
/* ---------- A whole web page copied ---------- */

/** Buttons and labels of chord sites (Ultimate Guitar…) that may sit inside the song's part. */
const SITE_UI = /^(x|print|autoscroll|strumming|tuning.*|difficulty.*|author.*|view official tab|transpose|simplify|font|edit|share|save|favorite|chords|tab|report bad tab|add to playlist|[+−-]\s*\d|\d+\s*(?:views?|vues?)|last (?:update|edit).*|rating.*|\d(?:[.,]\d)?\s*★?)$/i;

export interface PageSong { body: string; title?: string; artist?: string; key?: string; capo?: string }

/**
 * A whole web page copied (« Tout sélectionner »): the song inside it, from its first section or
 * chord line to its last, with the title, artist, key and capo the page shows (« Hotel California
 * Chords by Eagles », « Key: Bm », « Capo: 2nd fret »). Null when the text is just a song.
 */
export function extractSong(text: string): PageSong | null {
  const lines = textLines(text);
  const t = (i: number) => lines[i]?.text.trim() ?? '';
  const chord = (i: number) => !!t(i) && isChordLine(lines[i]);
  const lyric = (i: number) => !!t(i) && !chord(i) && !sectionLabel(t(i)) && !SITE_UI.test(t(i)) && !TAB.test(lines[i].text);
  // Lyrics under chords: words, not a page's label.
  const words = (i: number) => lyric(i) && t(i).split(/\s+/).length >= 2;
  const anchors: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (chord(i) && words(i + 1)) anchors.push(i, i + 1);
    else if (sectionLabel(t(i)) && [1, 2, 3].some(k => chord(i + k))) anchors.push(i);
  }
  if (!anchors.length) return null;
  const first = anchors[0];
  let last = anchors[anchors.length - 1];
  // Lyric lines without chords right after the last chords (the end of a verse).
  for (let j = last + 1; j <= last + 8 && lyric(j); j++) last = j;
  const outside = lines.filter((l, i) => (i < first || i > last) && l.text.trim()).length;
  if (outside < 6) return null; // a song, maybe with a few lines around it: the usual import

  const out: PageSong = { body: lines.slice(first, last + 1).map(l => l.text).filter(l => !SITE_UI.test(l.trim())).join('\n') };
  const head = lines.slice(0, first).map(l => l.text.trim());
  for (let i = 0; i < head.length; i++) {
    const h = head[i];
    const by = h.match(/^(.+?)\s+(?:ukulele\s+)?(?:chords|tabs?|accords?)\s+(?:by|de|par)\s+(.+)$/i);
    if (by && !out.title) { out.title = by[1].trim(); out.artist = by[2].trim(); continue; }
    const alone = h.match(/^(.+?)\s+(?:ukulele\s+)?(?:chords|tabs?|accords?)$/i);
    const next = head.slice(i + 1).find(x => x);
    if (alone && !out.title && next && /^(?:by|de|par)\s+\S/i.test(next)) { out.title = alone[1].trim(); out.artist = next.replace(/^(?:by|de|par)\s+/i, '').trim(); continue; }
    const key = h.match(/^(?:key|tonalit[ée])\s*:?\s*([A-H][#b♯♭]?m?)\b/i);
    if (key && !out.key) { out.key = key[1]; continue; }
    const capo = h.match(/^capo\s*:?\s*(\d{1,2})/i);
    if (capo && !out.capo) out.capo = capo[1];
  }
  return out;
}

export function textToChordPro(text: string, fallbackTitle?: string): string {
  if (looksLikeChordPro(text)) return text;
  // A whole page: keep only its song, with what the page says about it.
  const page = extractSong(text);
  if (page) {
    const head = [page.title && `Title: ${page.title}`, page.artist && `Artist: ${page.artist}`,
      page.key && `Key: ${page.key}`, page.capo && `Capo: ${page.capo}`].filter(Boolean);
    return sheetToChordPro(textLines([...head, '', page.body].join('\n')), { tolerance: 0.5, fallbackTitle }, () => false);
  }
  const lines = textLines(text);
  const first = lines.findIndex(l => l.text.trim());
  return sheetToChordPro(lines, { tolerance: 0.5, fallbackTitle }, (l, i) => i === first && l.text.trim().length <= 80);
}
