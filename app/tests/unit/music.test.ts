import { describe, expect, it } from 'vitest';
import { chordName, degreeOf, mod12, parseChordPro, transposeChord } from '../../src/lib/music';

describe('transposeChord', () => {
  it('keeps the chord when not transposing', () => {
    expect(transposeChord('Bb7', 0)).toBe('Bb7');
  });
  it('moves the root and keeps the quality', () => {
    expect(transposeChord('A7', 2)).toBe('B7');
    expect(transposeChord('F#m', 1)).toBe('Gm');
    expect(transposeChord('E', -1)).toBe('D#');
  });
  it('keeps flats spelled as flats', () => {
    expect(transposeChord('Bb', 2)).toBe('C');
    expect(transposeChord('Eb', 1)).toBe('E');
    expect(transposeChord('Ab', -1)).toBe('G');
    expect(transposeChord('Db', 3)).toBe('E');
    expect(transposeChord('Bb', 1)).toBe('B');
    expect(transposeChord('Eb', -2)).toBe('Db');
  });
  it('leaves anything that is not a chord alone', () => {
    expect(transposeChord('N.C.', 3)).toBe('N.C.');
  });
});

describe('parseChordPro', () => {
  const lines = parseChordPro('{c:Refrain}\n[A7]Minuit [D7]shuffle\nsans accord', 0);
  it('reads sections', () => {
    expect(lines[0]).toEqual({ kind: 'section', label: 'Refrain' });
  });
  it('puts each chord above its syllables', () => {
    const l = lines[1];
    expect(l.kind).toBe('line');
    if (l.kind !== 'line') return;
    expect(l.segs.map(s => s.chord.trim())).toEqual(['A7', 'D7']);
    expect(l.segs.map(s => s.text)).toEqual(['Minuit ', 'shuffle']);
  });
  it('keeps lyric lines without chords', () => {
    const l = lines[2];
    expect(l.kind === 'line' && l.segs[0].text).toBe('sans accord');
  });
  it('transposes while parsing', () => {
    const l = parseChordPro('[A]la', 3)[0];
    expect(l.kind === 'line' && l.segs[0].chord.trim()).toBe('C');
  });
});

describe('circle of fifths helpers', () => {
  it('names chords', () => {
    expect(chordName({ pc: 9 })).toBe('A');
    expect(chordName({ pc: 6, m: true })).toBe('F#m');
  });
  it('gives degrees in a major key', () => {
    expect(degreeOf(9, 2)).toBe('IV');
    expect(degreeOf(9, 6, true)).toBe('vi');
    expect(degreeOf(9, 1)).toBe('');
  });
  it('wraps pitch classes', () => {
    expect(mod12(-1)).toBe(11);
    expect(mod12(25)).toBe(1);
  });
});
