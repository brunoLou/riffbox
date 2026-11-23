import { describe, expect, it } from 'vitest';
import { chroma, parseChordName, rankChords, songChords, type ChordShape } from '../../src/lib/chordDetect';
import { OPEN_MIDI, chordType, voicingMidi, voicings } from '../../src/lib/chords';
import { SONG } from '../../src/lib/data';

import { N, SR, spectrum, strum } from './audioSynth';

const shape = (n: string) => parseChordName(n)!;
const detect = (midis: number[], cands: ChordShape[], seed?: number) => rankChords(chroma(spectrum(strum(midis, seed)), SR, N), cands);
const notesOf = (name: string, i = 0) => {
  const s = shape(name);
  const typeId = /maj7/.test(name) ? 'maj7' : /m7/.test(name) ? 'm7' : /7/.test(name) ? '7' : /m/.test(name) ? 'm' : 'maj';
  return voicingMidi(voicings(s.root, chordType(typeId))[i]);
};

describe('chord names', () => {
  it('reads roots, qualities and bass notes', () => {
    expect(shape('A7')).toMatchObject({ root: 9, pcs: [9, 1, 4, 7], bass: 9 });
    expect(shape('F#m')).toMatchObject({ root: 6, pcs: [6, 9, 1] });
    expect(shape('Bbmaj7').pcs).toEqual([10, 2, 5, 9]);
    expect(shape('C/G')).toMatchObject({ root: 0, bass: 7 });
    expect(shape('Amin').pcs).toEqual([9, 0, 4]);
    // The chord type, for drawing its diagram.
    expect(shape('Amin')!.type.id).toBe('m');
    expect(shape('Bbmaj7')!.type.id).toBe('maj7');
    expect(shape('D/F#')!.type.id).toBe('maj');
    expect(shape('Em7b5')!.type.id).toBe('m7b5');
    expect(shape('E7#9').pcs).toEqual([4, 8, 11, 2]);
    expect(parseChordName('N.C.')).toBeNull();
  });
  it('lists the chords of a song once each, in order', () => {
    expect(songChords(SONG).map(c => c.name)).toEqual(['A7', 'D7', 'E7', 'F#m', 'D']);
  });
});

describe('recognising a strummed chord among the song’s chords', () => {
  const minuit = songChords(SONG);
  for (const name of ['A7', 'D7', 'E7', 'F#m', 'D']) {
    it(`${name}, in several positions and strums`, () => {
      for (let pos = 0; pos < 2; pos++) for (let seed = 1; seed <= 4; seed++) {
        const r = detect(notesOf(name, pos), minuit, seed * 7 + pos);
        expect(r[0].name, `${name} position ${pos + 1}, grattage ${seed}`).toBe(name);
      }
    });
  }

  it('common open chords in a typical song (C, G, Am, F, Em, Dm)', () => {
    const cands = ['C', 'G', 'Am', 'F', 'Em', 'Dm'].map(shape);
    for (const name of ['C', 'G', 'Am', 'F', 'Em', 'Dm']) {
      for (let seed = 1; seed <= 3; seed++) expect(detect(notesOf(name), cands, seed)[0].name, `${name} ${seed}`).toBe(name);
    }
  });

  it('a clear winner: the best score stands out from the second', () => {
    const r = detect(notesOf('D7'), minuit, 3);
    expect(r[0].score - r[1].score).toBeGreaterThan(0.08);
  });

  it('silence and noise give no energy to speak of', () => {
    const quiet = new Float32Array(N).map((_, i) => Math.sin(i) * 1e-5);
    expect(chroma(spectrum(quiet), SR, N).energy).toBeLessThan(1e-8);
  });

  it('the open strings alone are not a chord of the song', () => {
    const r = detect(OPEN_MIDI, minuit, 2);
    expect(r[0].score).toBeLessThan(0.9);
  });
});
