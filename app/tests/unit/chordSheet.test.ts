import { describe, expect, it } from 'vitest';
import { chordToken, isChordLine, keyFromChords, looksLikeChordPro, mergeChords, sectionLabel, textLines, textToChordPro } from '../../src/lib/chordSheet';
import { importChordPro } from '../../src/lib/chordpro';
import { pageLines, pdfToChordPro } from '../../src/lib/pdfSheet';

const line = (t: string) => textLines(t)[0];

describe('chord names', () => {
  it('English and French names, with qualities and bass notes', () => {
    expect(['C', 'Am7', 'F#m', 'Bb', 'Gsus4', 'D/F#', 'Cmaj7', 'E7#9', 'Bm7b5', 'Cadd9', 'Ebdim', 'A(add9)'].map(chordToken))
      .toEqual(['C', 'Am7', 'F#m', 'Bb', 'Gsus4', 'D/F#', 'Cmaj7', 'E7#9', 'Bm7b5', 'Cadd9', 'Ebdim', 'A(add9)']);
    expect(['Lam', 'Do', 'Sol7', 'Ré', 'Fa#m', 'Si♭', 'Do/Mi', 'Mimaj7'].map(chordToken)).toEqual(['Am', 'C', 'G7', 'D', 'F#m', 'Bb', 'C/E', 'Emaj7']);
    expect(['la', 'Le', 'Amour', 'Do-ré', 'Hello', 'Sold'].map(chordToken)).toEqual([null, null, null, null, null, null]);
  });
  it('chord lines, bar and repeat marks included; lyrics are not chord lines', () => {
    expect(isChordLine(line('G    D/F#   Em  | C  (x2)'))).toBe(true);
    expect(isChordLine(line('Lam   Fa   Do   Sol'))).toBe(true);
    expect(isChordLine(line('La la la'))).toBe(false);
    expect(isChordLine(line('A la claire fontaine'))).toBe(false);
    expect(isChordLine(line('| / / |'))).toBe(false); // no chord at all
  });
  it('section labels in their usual forms', () => {
    expect(['[Verse 1]', 'Refrain :', '(Pont)', 'Couplet 2', 'PRÉ-REFRAIN', 'Chorus x2'].map(sectionLabel))
      .toEqual(['Verse 1', 'Refrain', 'Pont', 'Couplet 2', 'PRÉ-REFRAIN', 'Chorus x2']);
    expect(sectionLabel('Refrain de ma vie qui passe')).toBeNull(); // a lyric that starts with the word
    expect(sectionLabel('Solo de guitare au clair de lune')).toBeNull();
  });
});

describe('placing chords above the lyrics', () => {
  it('each chord on the letter under it; chords past the end follow the line', () => {
    const c = line('G          D            Em');
    const l = line('J’ai pris la route avant le jour');
    expect(mergeChords(c, l, 0.5)).toBe('[G]J’ai pris l[D]a route avant [Em]le jour'); // above a space: the next word
    expect(mergeChords(line('C              G'), line('Oh oh'), 0.5)).toBe('[C]Oh oh [G]');
  });
  it('a whole sheet: title, artist, capo, sections, chords-only lines, tabs left out, key from the chords', () => {
    const cp = textToChordPro([
      'Le Fleuve - Jean Dupont', 'Capo 2', '', '[Intro]', 'G  D  Em  C  (x2)', '',
      '[Verse 1]', 'G           D', 'Le fleuve dort sous la chaleur', 'Em          C', 'Et moi je compte les heures', '',
      'e|---3---5---|', 'Refrain :', 'C       G', 'Rien ne presse',
    ].join('\n'));
    expect(cp).toBe([
      '{title: Le Fleuve}', '{artist: Jean Dupont}', '{key: G}', '{capo: 2}',
      '{c:Intro}', '[G] [D] [Em] [C] (x2)', '',
      '{c:Verse 1}', '[G]Le fleuve do[D]rt sous la chaleur', '[Em]Et moi je co[C]mpte les heures', '',
      '{c:Refrain}', '[C]Rien ne [G]presse',
    ].join('\n'));
    const [song] = importChordPro(cp);
    expect(song).toMatchObject({ title: 'Le Fleuve', artist: 'Jean Dupont', key: 7, capo: 2 });
  });
  it('French chord names become letters; the key is read from the chords (minor too)', () => {
    const cp = textToChordPro('Lam      Fa      Do        Mi7\nIl pleure dans mon cœur\nLam\nComme il pleut', 'Ma chanson');
    expect(cp.split('\n').slice(0, 3)).toEqual(['{title: Ma chanson}', '{key: Am}', '[Am]Il pleure [F]dans mo[C]n cœur [E7]']);
    expect(keyFromChords('[D] [G] [A] [Bm] [G] [A] [D]')).toBe('D');
  });
  it('text already in ChordPro is left as it is', () => {
    const t = '{title: X}\n[C]Hello [G]world';
    expect(looksLikeChordPro(t)).toBe(true);
    expect(textToChordPro(t)).toBe(t);
    expect(looksLikeChordPro('[Verse 1]\nG  D\nHello')).toBe(false); // a section in brackets is not an inline chord
  });
});

describe('PDF pages', () => {
  // Items as pdf.js gives them: text, x, y (from the bottom), width, font size. A proportional font.
  const item = (str: string, x: number, y: number, size = 12) => ({ str, x, y, w: str.length * size * 0.5, size });
  it('lines from items on one baseline, blank lines from big gaps, chords aligned by position', () => {
    const lines = pageLines([
      item('Ma chanson', 50, 800, 20),
      item('G', 50, 760), item('D', 104, 760),
      item('Le fleuve dort', 50, 746), item('sous la chaleur', 140, 746),
      item('Em', 50, 690), item('Rien', 50, 676),
    ], 1);
    expect(lines.map(l => l.text)).toEqual(['Ma chanson', 'G D', 'Le fleuve dort sous la chaleur', 'Em', 'Rien']);
    expect(lines.map(l => !!l.gapBefore)).toEqual([false, false, false, true, false]);
    const cp = pdfToChordPro(lines, 'fichier');
    // D at x=104: above the space before « dort » (9 chars × 6 pt from 50), so on « dort ».
    expect(cp).toBe('{title: Ma chanson}\n{key: G}\n[G]Le fleuve [D]dort sous la chaleur\n\n[Em]Rien');
  });
  it('a songbook: each large title starts a song; without titles, the file name', () => {
    const lines = pageLines([
      item('Premier', 50, 800, 20), item('C', 50, 770), item('Un', 50, 756),
      item('Second', 50, 700, 20), item('Am', 50, 670), item('Deux', 50, 656),
    ], 1);
    const songs = importChordPro(pdfToChordPro(lines, 'recueil'));
    expect(songs.map(s => [s.title, s.chordpro])).toEqual([['Premier', '[C]Un'], ['Second', '[Am]Deux']]);
    const plain = pageLines([item('G', 50, 770), item('Bonjour', 50, 756)], 1);
    expect(importChordPro(pdfToChordPro(plain, 'mon fichier')).map(s => s.title)).toEqual(['mon fichier']);
  });
});
