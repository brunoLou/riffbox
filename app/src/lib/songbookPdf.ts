/**
 * A songbook as a real PDF file (to share with the band or print): chords above the lyrics in a
 * fixed-width font so they stay on their syllables, sections in bold, and for a setlist a first page
 * with the running order. Written by hand with the fonts every PDF reader has (Courier, Helvetica):
 * no library, works offline. Pure, no browser.
 */
import { transposeChord } from './music';

/* ---------- Text layout ---------- */

export type SheetRow = { kind: 'section'; text: string } | { kind: 'chords'; text: string } | { kind: 'lyric'; text: string } | { kind: 'gap' };

/** A ChordPro body as rows: each lyric line under its chord line (« G     D » over the words). */
export function chordproRows(src: string, transpose = 0, width = 80): SheetRow[] {
  const rows: SheetRow[] = [];
  for (const raw of src.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) { if (rows.length && rows[rows.length - 1].kind !== 'gap') rows.push({ kind: 'gap' }); continue; }
    const dir = line.match(/^\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}$/i);
    if (dir) {
      const [, name, value] = dir;
      if (/^(c|comment|ci|comment_italic|soc|start_of_chorus|sov|start_of_verse|sob|start_of_bridge)$/i.test(name)) {
        rows.push({ kind: 'section', text: value || (/chorus/i.test(name) ? 'Refrain' : /bridge/i.test(name) ? 'Pont' : 'Couplet') });
      }
      continue; // title, key, capo… are shown in the heading
    }
    // Chords at the column of the syllable they belong to; the lyric widened when a chord is longer.
    let chords = '', lyric = '';
    for (const part of line.split(/(\[[^\]]+\])/)) {
      const m = part.match(/^\[([^\]]+)\]$/);
      if (m) {
        const c = transposeChord(m[1], transpose);
        if (chords.length > lyric.length) lyric = lyric.padEnd(chords.length, ' ');
        chords = chords.padEnd(lyric.length, ' ') + c + ' ';
      } else lyric += part;
    }
    chords = chords.trimEnd();
    const hasLyric = !!lyric.trim();
    for (let a = 0; a < Math.max(chords.length, lyric.length); a += width) {
      const c = chords.slice(a, a + width), l = lyric.slice(a, a + width);
      if (c.trim()) rows.push({ kind: 'chords', text: c });
      if (hasLyric && l.trim()) rows.push({ kind: 'lyric', text: l });
    }
  }
  while (rows.length && rows[rows.length - 1].kind === 'gap') rows.pop();
  return rows;
}

/* ---------- PDF writing ---------- */

const W = 595.28, H = 841.89, M = 48; // A4, margins
type Font = 'F1' | 'F2' | 'F3'; // Courier, Courier-Bold, Helvetica-Bold
interface Run { font: Font; size: number; x: number; y: number; text: string; gray?: number }

/** Text in a PDF string (WinAnsi): accents kept, musical signs written # and b. */
export function pdfString(s: string): string {
  const map: Record<string, number> = { '’': 0x92, '‘': 0x91, '“': 0x93, '”': 0x94, '…': 0x85, '–': 0x96, '—': 0x97, 'œ': 0x9c, 'Œ': 0x8c, '€': 0x80, '•': 0x95 };
  let out = '';
  for (const ch of s.replace(/♯/g, '#').replace(/♭/g, 'b').replace(/ | /g, ' ')) {
    const code = map[ch] ?? ch.charCodeAt(0);
    if (ch === '(' || ch === ')' || ch === '\\') out += '\\' + ch;
    else if (code >= 32 && code < 127) out += ch;
    else if (code < 256) out += '\\' + code.toString(8).padStart(3, '0');
    else out += '?';
  }
  return `(${out})`;
}

/** Pages of text runs → the bytes of a PDF file. */
function writePdf(pages: Run[][], title: string): Uint8Array {
  const objs: string[] = [];
  const add = (s: string) => { objs.push(s); return objs.length; };
  const catalog = add(''), pagesId = add('');
  const fonts = [add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>'),
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>'),
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')];
  const kids: number[] = [];
  for (const runs of pages) {
    const content = runs.map(r => `BT /${r.font} ${r.size} Tf ${r.gray !== undefined ? `${r.gray} g ` : '0 g '}${r.x.toFixed(2)} ${r.y.toFixed(2)} Td ${pdfString(r.text)} Tj ET`).join('\n');
    const stream = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${fonts[0]} 0 R /F2 ${fonts[1]} 0 R /F3 ${fonts[2]} 0 R >> >> /Contents ${stream} 0 R >>`));
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map(k => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  const info = add(`<< /Title ${pdfString(title)} /Producer (RIFFBOX) >>`);
  let body = '%PDF-1.4\n%âãÏÓ\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(body.length); body += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = body.length;
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  body += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // Every character is one byte (WinAnsi escapes are ASCII), so offsets are byte offsets.
  return Uint8Array.from(body, c => c.charCodeAt(0) & 0xff);
}

/* ---------- The songbook ---------- */

export interface BookSong { title: string; artist?: string; info: string; memo?: string; chordpro: string; transpose?: number }
export interface BookCover { name: string; when?: string; rows: { n: number; title: string; at?: string; dur: string; memo?: string }[]; total: string }

const SIZE = 10.5, LEAD = 13, CW = SIZE * 0.6; // Courier: 600/1000 em
const COLS = Math.floor((W - 2 * M) / CW);

/** The songbook's pages: a running order first (for a setlist), then each song (a new page when it would not fit well). */
export function songbookPdf(title: string, songs: BookSong[], cover?: BookCover): Uint8Array {
  const pages: Run[][] = [];
  let page: Run[] = [], y = H - M;
  const newPage = () => { if (page.length) pages.push(page); page = []; y = H - M; };
  const text = (font: Font, size: number, s: string, x = M, gray?: number) => { page.push({ font, size, x, y, text: s, gray }); };

  if (cover) {
    text('F3', 26, cover.name); y -= 22;
    if (cover.when) { text('F1', 11, cover.when, M, 0.35); y -= 16; }
    text('F1', 11, `${cover.rows.length} titres · ${cover.total}`, M, 0.35); y -= 30;
    for (const r of cover.rows) {
      if (y < M + 30) newPage();
      text('F3', 13, `${r.n}.`); text('F3', 13, r.title.slice(0, 48), M + 26);
      text('F1', 10, [r.at, r.dur].filter(Boolean).join('  ·  '), W - M - 110, 0.35);
      y -= 15;
      if (r.memo) { text('F1', 9.5, r.memo.slice(0, 80), M + 26, 0.3); y -= 13; }
      y -= 6;
    }
    newPage();
  }

  for (const s of songs) {
    const rows = chordproRows(s.chordpro, s.transpose ?? 0, COLS);
    const need = 60 + rows.length * LEAD;
    // A song starts on a new page unless it fits in what is left (and the page has room).
    if (page.length && (y - need < M || y < H * 0.45)) newPage();
    text('F3', 18, s.title.slice(0, 50)); y -= 18;
    text('F1', 10, [s.artist, s.info].filter(Boolean).join('  ·  '), M, 0.35); y -= 14;
    if (s.memo) { text('F2', 10, `Mémo : ${s.memo}`.slice(0, COLS)); y -= 14; }
    y -= 8;
    if (!rows.length) { text('F1', SIZE, '(pas encore de paroles ni d’accords)', M, 0.5); y -= LEAD; }
    for (const r of rows) {
      if (y < M) { newPage(); text('F1', 9, `${s.title} (suite)`, M, 0.5); y -= LEAD + 4; }
      if (r.kind === 'gap') { y -= LEAD * 0.6; continue; }
      if (r.kind === 'section') { y -= 3; text('F3', 11, r.text.toUpperCase(), M, 0.3); y -= LEAD + 1; continue; }
      text(r.kind === 'chords' ? 'F2' : 'F1', SIZE, r.text);
      y -= LEAD;
    }
    y -= 24;
  }
  newPage();
  return writePdf(pages.length ? pages : [[]], title);
}
