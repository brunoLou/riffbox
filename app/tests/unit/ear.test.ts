import { describe, expect, it } from 'vitest';
import { chordFr, heardTarget, makeQuestion, recordAnswer, summary } from '../../src/lib/ear';

const seq = (...xs: number[]) => { let i = 0; return () => xs[i++ % xs.length]; };

describe('ear training', () => {
  it('intervals: two notes the right distance apart, choices of the level', () => {
    const q = makeQuestion('intervals', 1, seq(0.5, 0.3));
    expect(q.choices.map(c => c.label)).toEqual(['Quarte juste', 'Quinte juste', 'Octave']);
    expect(q.notes[1] - q.notes[0]).toBe(Number(q.answer));
    expect(q.notes[0]).toBeGreaterThanOrEqual(52);
    expect(makeQuestion('intervals', 3).choices).toHaveLength(12);
  });

  it('not the same answer twice in a row', () => {
    for (let i = 0; i < 30; i++) {
      const a = makeQuestion('intervals', 1);
      expect(makeQuestion('intervals', 1, Math.random, a.answer).answer).not.toBe(a.answer);
    }
  });

  it('chords: a guitar voicing of the quality asked', () => {
    const q = makeQuestion('chords', 2, seq(0.5, 0.25));
    expect(q.choices).toHaveLength(5);
    expect(q.notes.length).toBeGreaterThanOrEqual(4);
    expect(q.choices.some(c => c.id === q.answer)).toBe(true);
  });

  it('playing: a chord to play, recognised among the level’s chords; French names', () => {
    const q = makeQuestion('play', 1, seq(0));
    expect(q.chord).toBe('C');
    expect(q.candidates).toContain('Am');
    expect(chordFr('F#m')).toBe('Fa♯ mineur');
    expect(chordFr('C')).toBe('Do majeur');
    expect(chordFr('E7')).toBe('Mi sept');
    expect(heardTarget(['C', 'C', null, 'C', 'C', 'C', 'C'], 'C')).toBe(true);
    expect(heardTarget(['C', 'Am', 'C', 'Am', 'C'], 'C')).toBe(false);
  });

  it('scores: success rate and the answer that resists', () => {
    let s = {};
    for (const ok of [true, true, true]) s = recordAnswer(s, 'intervals', '7', ok);
    for (const ok of [false, true, false]) s = recordAnswer(s, 'intervals', '5', ok);
    expect(summary(s, 'intervals')).toEqual({ n: 6, rate: 67, weakest: '5' });
    expect(summary(s, 'chords')).toEqual({ n: 0, rate: null, weakest: null });
  });
});
