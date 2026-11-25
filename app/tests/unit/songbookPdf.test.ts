import { describe, expect, it } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { chordproRows, pdfString, songbookPdf } from '../../src/lib/songbookPdf';

const SONG = `{title: Fil d'argent}
{c:Couplet}
[Em]Sur la route au [C]petit jour
[G]Je reviens [D7sus4]chan[A]ter l’amour

{c:Refrain}
[G] [D] [Em]`;

/** Each page as a PDF reader sees it: its text line by line, and where each word sits. */
async function readPdf(bytes: Uint8Array) {
  const doc = await getDocument({ data: bytes, useSystemFonts: false, isEvalSupported: false, standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/' }).promise;
  const pages: { text: string; words: { s: string; x: number; y: number }[] }[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    const items = c.items.filter(x => 'str' in x) as { str: string; transform: number[]; hasEOL: boolean }[];
    pages.push({ text: items.map(x => x.str + (x.hasEOL ? '\n' : '')).join(''), words: items.map(x => ({ s: x.str, x: x.transform[4], y: x.transform[5] })) });
  }
  return pages;
}

describe('songbook PDF', () => {
  it('chords above their syllables, a long chord widens the lyric, sections apart', () => {
    const rows = chordproRows(SONG);
    expect(rows).toEqual([
      { kind: 'section', text: 'Couplet' },
      { kind: 'chords', text: 'Em              C' },
      { kind: 'lyric', text: 'Sur la route au petit jour' },
      { kind: 'chords', text: 'G          D7sus4 A' },
      { kind: 'lyric', text: 'Je reviens chan   ter l’amour' },
      { kind: 'gap' },
      { kind: 'section', text: 'Refrain' },
      { kind: 'chords', text: 'G D Em' },
    ]);
    expect(chordproRows('[Am]Une', 3)[0]).toEqual({ kind: 'chords', text: 'Cm' }); // transposed as played on stage
  });

  it('accents and apostrophes kept, signs written # and b', () => {
    expect(pdfString('Fa♯ à l’été (bis)')).toBe('(Fa# \\340 l\\222\\351t\\351 \\(bis\\))');
  });

  it('a real PDF: the running order first, then each song a reader can read', async () => {
    const bytes = songbookPdf('Bar du Port', [
      { title: 'Fil d’argent', artist: 'Les Cordes', info: 'Mi m · 92 BPM · capo 2', memo: 'Léa compte l’intro', chordpro: SONG },
      { title: 'Café noir', info: 'Ré m · 98 BPM', chordpro: '' },
    ], { name: 'Bar du Port', when: 'Jeu. 3 déc. · 21:00', total: '40 min', rows: [{ n: 1, title: 'Fil d’argent', at: '21:00', dur: '3:20', memo: 'Léa compte l’intro' }, { n: 2, title: 'Café noir', dur: '4:05' }] });
    expect(new TextDecoder('latin1').decode(bytes.slice(0, 8))).toBe('%PDF-1.4');
    const pages = await readPdf(bytes);
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(pages[0].text).toContain('Bar du Port');
    expect(pages[0].text).toContain('Fil d’argent');
    expect(pages[0].text).toContain('21:00');
    const song = pages.slice(1).map(p => p.text).join('\n');
    expect(song).toContain('Sur la route au petit jour');
    expect(song).toContain('Mémo : Léa compte l’intro');
    expect(song).toContain('COUPLET');
    expect(song).toContain('(pas encore de paroles ni d’accords)');
    // The C chord sits right above « petit ».
    const words = pages.slice(1).flatMap(p => p.words);
    const c = words.find(w => w.s === 'C')!, petit = words.find(w => w.s.startsWith('petit'))!;
    expect(Math.abs(c.x - petit.x)).toBeLessThan(0.5);
    expect(c.y).toBeGreaterThan(petit.y);
  });
});
