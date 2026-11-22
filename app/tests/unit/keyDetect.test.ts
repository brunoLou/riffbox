import { describe, expect, it } from 'vitest';
import { chordType, voicingMidi, voicings } from '../../src/lib/chords';
import { KeyListener, keyLabel, rankKeys, relativeOf } from '../../src/lib/keyDetect';
import { mod12 } from '../../src/lib/music';
import { N, SR, spectrum, strum } from './audioSynth';

/** A chord on the guitar: root pitch class and type id, lowest playable position. */
const notes = (root: number, type: string) => voicingMidi(voicings(mod12(root), chordType(type))[0]);

/** Play chords (root offsets from the tonic and types), 4 frames each, into a listener. */
function listen(tonic: number, chords: [number, string][], rounds = 3, seed = 1) {
  const l = new KeyListener();
  let s = seed;
  for (let r = 0; r < rounds; r++) for (const [off, t] of chords) {
    for (const at of [0.1, 0.4, 0.8, 1.2]) l.add(spectrum(strum(notes(tonic + off, t), s++, at)), SR, N, 0.1, 0.5);
  }
  return l;
}

const MAJOR_SONGS: [string, [number, string][]][] = [
  ['I–IV–V–I', [[0, 'maj'], [5, 'maj'], [7, 'maj'], [0, 'maj']]],
  ['I–vi–IV–V', [[0, 'maj'], [9, 'm'], [5, 'maj'], [7, 'maj']]],
  ['blues I7–IV7–V7', [[0, '7'], [0, '7'], [5, '7'], [0, '7'], [7, '7'], [5, '7'], [0, '7']]],
];
const MINOR_SONGS: [string, [number, string][]][] = [
  ['i–iv–V–i', [[0, 'm'], [5, 'm'], [7, 'maj'], [0, 'm']]],
  ['i–VI–III–VII', [[0, 'm'], [8, 'maj'], [3, 'maj'], [10, 'maj']]],
];

describe('key profiles', () => {
  it('the notes of a major scale give its key', () => {
    const c = new Array(12).fill(0);
    [0, 2, 4, 5, 7, 9, 11].forEach(i => (c[mod12(i + 2)] = [3, 1, 2, 1.5, 2.5, 1, 1][[0, 2, 4, 5, 7, 9, 11].indexOf(i)]));
    expect(keyLabel(rankKeys(c)[0])).toBe('Ré majeur');
  });
  it('relative keys', () => {
    expect(keyLabel({ ...relativeOf({ key: 9, minor: false }) })).toBe('Fa♯ mineur');
    expect(keyLabel({ ...relativeOf({ key: 4, minor: true }) })).toBe('Sol majeur');
  });
});

describe('listening to chord progressions in every key', () => {
  for (const [name, chords] of MAJOR_SONGS) {
    it(`${name}, 12 major keys`, () => {
      const wrong: string[] = [];
      for (let k = 0; k < 12; k++) {
        const v = listen(k, chords, 2, k + 1).verdict()!;
        const ok = v.best.key === k && !v.best.minor;
        // Its relative minor, flagged as close, is acceptable: the app shows both.
        const rel = v.relativeClose && relativeOf(v.best).key === k && relativeOf(v.best).minor === false;
        if (!ok && !rel) wrong.push(`${keyLabel({ key: k, minor: false })} → ${keyLabel(v.best)}`);
      }
      expect(wrong).toEqual([]);
    });
  }
  for (const [name, chords] of MINOR_SONGS) {
    it(`${name}, 12 minor keys`, () => {
      const wrong: string[] = [];
      for (let k = 0; k < 12; k++) {
        const v = listen(k, chords, 2, k + 7).verdict()!;
        const ok = v.best.key === k && v.best.minor;
        const rel = v.relativeClose && relativeOf(v.best).key === k && relativeOf(v.best).minor === true;
        if (!ok && !rel) wrong.push(`${keyLabel({ key: k, minor: true })} → ${keyLabel(v.best)}`);
      }
      expect(wrong).toEqual([]);
    });
  }
});

describe('the verdict', () => {
  it('waits for a few seconds of music, and ignores silence', () => {
    const l = new KeyListener();
    l.add(new Float32Array(N / 2), SR, N, 0.001, 0.5);
    expect(l.heard).toBe(0);
    for (let i = 0; i < 4; i++) l.add(spectrum(strum(notes(7, 'maj'), i)), SR, N, 0.1, 0.5);
    expect(l.verdict()).toBeNull();
  });
  it('a clear song is « très probable » after a while', () => {
    const v = listen(2, MAJOR_SONGS[0][1], 4).verdict()!;
    expect(keyLabel(v.best)).toBe('Ré majeur');
    expect(v.confidence).toBe('sure');
  });
});
