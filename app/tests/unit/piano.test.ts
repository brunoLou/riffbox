import { describe, expect, it } from 'vitest';
import { chordType, voicings } from '../../src/lib/chords';
import { chordSpelling, guitarNotes, keyRange, nameChord, pianoVoicing } from '../../src/lib/piano';

describe('piano side of a chord', () => {
  it('as a pianist plays it: root in the left hand, close chord in the right', () => {
    expect(pianoVoicing(9, chordType('m7'))).toEqual([57, 69, 72, 76, 79]); // A3 | A4 C5 E5 G5
    expect(pianoVoicing(0, chordType('maj'))).toEqual([48, 60, 64, 67]);
    expect(pianoVoicing(0, chordType('add9'))).toEqual([48, 60, 64, 67, 74]); // the ninth an octave up
  });

  it('the guitar position’s own notes, low to high, and a keyboard that shows them', () => {
    const openE = voicings(4, chordType('maj')).find(v => v.frets.every(f => f !== null && f <= 2))!;
    expect(guitarNotes(openE)).toEqual([40, 47, 52, 56, 59, 64]);
    expect(keyRange(guitarNotes(openE))).toEqual([36, 71]);
    expect(keyRange([60, 64])).toEqual([60, 83]); // two octaves at least
  });

  it('names the chord touched on the keys, root in the bass first', () => {
    expect(nameChord([60, 64, 67])[0].name).toBe('C');
    expect(nameChord([64, 67, 72])[0].name).toBe('C/E');
    expect(nameChord([57, 60, 64, 67])[0].name).toBe('Am7');
    expect(nameChord([60, 64, 67, 70])[0].name).toBe('C7');
    expect(nameChord([48, 55])[0].name).toBe('C5');
    expect(nameChord([60, 64, 70])[0].name).toBe('C7'); // the fifth may be left out
    expect(nameChord([60, 61, 62])).toEqual([]);
    expect(nameChord([])).toEqual([]);
  });

  it('writes the notes as in the chord', () => {
    expect(chordSpelling(4, chordType('maj'))).toEqual({ 4: 'E', 8: 'G#', 11: 'B' });
    expect(chordSpelling(0, chordType('7'))).toMatchObject({ 10: 'Bb' });
    expect(chordSpelling(3, chordType('m'))).toEqual({ 3: 'Eb', 6: 'Gb', 10: 'Bb' });
    expect(chordSpelling(0, chordType('dim7'))).toMatchObject({ 3: 'Eb', 6: 'Gb', 9: 'Bbb' });
  });
});
