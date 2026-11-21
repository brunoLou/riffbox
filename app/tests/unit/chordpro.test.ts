import { describe, expect, it } from 'vitest';
import { chordProFileName, exportChordPro, exportSongbook, importChordPro, parseKey } from '../../src/lib/chordpro';
import { INITIAL_SONGS, type Song } from '../../src/lib/setlists';

describe('keys', () => {
  it('reads English and French spellings', () => {
    expect(parseKey('Am')).toEqual({ key: 9, minor: true });
    expect(parseKey('F#')).toEqual({ key: 6, minor: false });
    expect(parseKey('Bbm')).toEqual({ key: 10, minor: true });
    expect(parseKey('Cmaj')).toEqual({ key: 0, minor: false });
    expect(parseKey('Do♯ m')).toEqual({ key: 1, minor: true });
    expect(parseKey('Si bémol mineur')).toEqual({ key: 10, minor: true });
    expect(parseKey('Ré')).toEqual({ key: 2, minor: false });
    expect(parseKey('?')).toBeNull();
  });
});

describe('import', () => {
  const FILE = `# made with another app
{title: Le Quai}
{subtitle: Les Néons}
{key: Em}
{tempo: 84}
{capo: 2}
{duration: 3:45}
{textfont: Helvetica}

{start_of_verse}
[Em]Les néons tremblent [C]au bord du quai
{end_of_verse}

{soc: Refrain final}
[G]La nuit s’é[D]tire
{eoc}
{c: Solo}
{chorus}
`;

  it('reads the metadata', () => {
    const [s] = importChordPro(FILE, 'quai.cho');
    expect(s).toMatchObject({ title: 'Le Quai', artist: 'Les Néons', key: 4, minor: true, bpm: 84, capo: 2, duration: 225 });
  });

  it('turns sections into labels and drops what does not apply', () => {
    const [s] = importChordPro(FILE);
    expect(s.chordpro).toBe([
      '{c:Couplet}', '[Em]Les néons tremblent [C]au bord du quai', '',
      '{c:Refrain final}', '[G]La nuit s’é[D]tire', '', '{c:Solo}', '{c:Refrain}',
    ].join('\n'));
  });

  it('falls back on the file name, the first chord and defaults', () => {
    const [s] = importChordPro('[Dm]Une ligne\n[A7]Une autre', 'mon_blues-lent.chopro');
    expect(s).toMatchObject({ title: 'mon blues lent', key: 2, minor: true, bpm: 90, capo: 0, duration: 210 });
  });

  it('splits a songbook on {new_song}', () => {
    const songs = importChordPro('{t: Un}\n[A]la\n{new_song}\n{t: Deux}\n[B]si\n{ns}\n{t: Trois}');
    expect(songs.map(s => s.title)).toEqual(['Un', 'Deux', 'Trois']);
  });

  it('accepts ChordPro 6 label attributes and Windows line ends', () => {
    const [s] = importChordPro('{title: X}\r\n{start_of_chorus label="Refrain 2"}\r\n[C]do\r\n{end_of_chorus}\r\n');
    expect(s.chordpro).toBe('{c:Refrain 2}\n[C]do');
  });
});

describe('export', () => {
  it('writes standard directives, then the text', () => {
    const s: Song = { id: 'x', title: 'Néons du quai', key: 11, minor: true, bpm: 72, feel: 'ballade', capo: 2, duration: 260, melodyLow: 59, melodyHigh: 74, chordpro: '{c:Couplet}\n[Bm]Les néons' };
    expect(exportChordPro(s)).toBe([
      '{title: Néons du quai}', '{key: Bm}', '{tempo: 72}', '{capo: 2}', '{duration: 4:20}',
      '{x_riffbox_feel: ballade}', '{x_riffbox_melody: 59 74}', '', '{c:Couplet}', '[Bm]Les néons', '',
    ].join('\n'));
  });

  it('every example song comes back the same after export and import', () => {
    for (const s of INITIAL_SONGS) {
      const [back] = importChordPro(exportChordPro(s));
      const { id: _id, ...rest } = s;
      expect(back).toEqual({ ...rest, chordpro: (s.chordpro ?? '').replace(/\s+$/, '') });
    }
  });

  it('a songbook re-imports as the same songs', () => {
    expect(importChordPro(exportSongbook(INITIAL_SONGS)).map(s => s.title)).toEqual(INITIAL_SONGS.map(s => s.title));
  });

  it('names the file after the title', () => {
    expect(chordProFileName('Poussière d’août')).toBe('poussiere-d-aout.cho');
    expect(chordProFileName('???')).toBe('morceau.cho');
  });
});
