/**
 * Text of a PDF, line by line with the position of each character, read in the browser with
 * pdf.js (nothing is sent anywhere). Loaded on first use only.
 */
import type { SheetLine } from './chordSheet';
import { sheetToChordPro } from './chordSheet';

interface Item { str: string; x: number; y: number; w: number; size: number }

/** Lines of a page: items on the same baseline, left to right, with a blank line where the gap is large. */
export function pageLines(items: Item[], page: number): SheetLine[] {
  const rows: Item[][] = [];
  for (const it of [...items].filter(i => i.str.length).sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row[0].y - it.y) <= Math.max(1, Math.min(row[0].size, it.size) * 0.4)) row.push(it);
    else rows.push([it]);
  }
  const out: SheetLine[] = [];
  let prevY: number | null = null, prevSize = 0;
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    let text = '';
    const xs: number[] = [];
    let end = -Infinity;
    for (const it of row) {
      const cw = it.w / Math.max(1, it.str.length);
      if (text && it.x - end > it.size * 0.2 && !text.endsWith(' ')) { text += ' '; xs.push(end); }
      for (let k = 0; k < it.str.length; k++) { text += it.str[k]; xs.push(it.x + k * cw); }
      end = it.x + it.w;
    }
    const size = Math.max(...row.map(r => r.size));
    const y = row[0].y;
    // A blank line: more than about two lines of space above.
    const gapBefore = prevY !== null && prevY - y > Math.max(size, prevSize) * 2.1;
    out.push({ text: text.replace(/\s+$/, ''), xs, size, gapBefore, page });
    prevY = y; prevSize = size;
  }
  return out;
}

/** The usual size of the body text, to tell titles (larger) from lyrics. */
function bodySize(lines: SheetLine[]): number {
  const sizes = lines.filter(l => l.text.trim()).map(l => Math.round((l.size ?? 0) * 2) / 2);
  const freq = new Map<number, number>();
  sizes.forEach(s => freq.set(s, (freq.get(s) ?? 0) + 1));
  return [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 10;
}

/** Every line of every page of a PDF file. */
export async function pdfLines(data: ArrayBuffer): Promise<SheetLine[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false }).promise;
  const lines: SheetLine[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items: Item[] = [];
    for (const it of content.items) {
      if (!('str' in it)) continue;
      const [a, b, , , e, f] = it.transform as number[];
      items.push({ str: it.str, x: e, y: f, w: it.width, size: Math.hypot(a, b) || it.height });
    }
    if (p > 1) lines.push({ text: '', xs: [], page: p });
    lines.push(...pageLines(items, p));
  }
  await doc.destroy();
  return lines;
}

/**
 * A PDF chord sheet (or songbook) → ChordPro. Lines clearly larger than the lyrics are titles:
 * each starts a new song. Without any, the whole file is one song named after the file.
 */
export function pdfToChordPro(lines: SheetLine[], fileTitle: string): string {
  const body = bodySize(lines);
  const titleLike = (l: SheetLine) => (l.size ?? 0) >= body * 1.25 && l.text.trim().length <= 80;
  // Only the first of consecutive large lines is the title (the next may be the artist).
  const isTitle = (l: SheetLine, i: number) => titleLike(l) && !(i > 0 && titleLike(lines[i - 1]) && !lines[i - 1].gapBefore && lines[i - 1].text.trim() !== '');
  const hasTitles = lines.some(titleLike);
  return sheetToChordPro(lines, { tolerance: body * 0.3, fallbackTitle: fileTitle }, hasTitles ? isTitle : () => false);
}
