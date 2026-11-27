import { describe, expect, it } from 'vitest';
import { MAX_GAP, OFF_SESSION_MIN, activeGap, offSeconds, withOff } from '../../src/lib/offGuitar';
import { makeQuestion, progressionChords } from '../../src/lib/ear';
import { chordShow } from '../../src/lib/theory';

describe('practice without a guitar', () => {
  it('counts only active time between two answers', () => {
    expect(activeGap(0, 12_000)).toBe(12);
    expect(activeGap(0, 600_000)).toBe(MAX_GAP);
    expect(activeGap(5_000, 1_000)).toBe(0);
  });
  it('adds its minutes to the practice log, day by day', () => {
    const off = { '2026-11-26': { theory: 250, ear: 70 }, '2026-11-27': { progressions: 50 } };
    expect(offSeconds(off, '2026-11-26')).toBe(320);
    expect(offSeconds(off, '2026-11-26', 'ear')).toBe(70);
    expect(withOff({ '2026-11-26': 20, '2026-11-25': 30 }, off)).toEqual({ '2026-11-26': 25, '2026-11-25': 30 });
    expect(OFF_SESSION_MIN).toBe(10);
  });
});

describe('chord progressions by ear', () => {
  it('spells the progression in its key', () => {
    expect(progressionChords('I-V-vi-IV', 7).map(chordShow)).toEqual(['G', 'D', 'Em', 'C']);
    expect(progressionChords('I-bVII-IV-I', 2).map(chordShow)).toEqual(['D', 'C', 'G', 'D']);
    expect(progressionChords('i-bVII-bVI-V', 9).map(chordShow)).toEqual(['Am', 'G', 'F', 'E']);
    expect(progressionChords('ii-V-I', 5).map(chordShow)).toEqual(['Gm', 'C', 'F', 'F']);
  });
  it('plays four chords and offers the level’s progressions', () => {
    const q = makeQuestion('progressions', 1, () => 0);
    expect(q.seq).toHaveLength(4);
    expect(q.choices.map(c => c.id)).toEqual(['I-IV-V-I', 'I-V-vi-IV', 'I-vi-IV-V']);
    expect(q.reveal).toBe('En Do majeur : C – F – G – C');
    expect(makeQuestion('progressions', 3, () => 0.5).choices).toHaveLength(9);
  });
});
