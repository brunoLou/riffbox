import { describe, expect, it } from 'vitest';
import { guessChord, heard, roomLabel, toDb, verdict } from '../../src/lib/micCheck';

const chromaOf = (w: Record<number, number>) => { const c = new Array(12).fill(0); for (const [pc, v] of Object.entries(w)) c[+pc] = v; const s = c.reduce((a, b) => a + b, 0); return c.map(x => x / s); };

describe('microphone check', () => {
  it('rates the level', () => {
    expect(verdict(-70, 0.001).kind).toBe('silence');
    expect(verdict(-48, 0.02).kind).toBe('faible');
    expect(verdict(-25, 0.3).kind).toBe('bon');
    expect(verdict(-8, 0.6).kind).toBe('fort');
    expect(verdict(-20, 0.95).kind).toBe('fort');
    expect(verdict(-12, 0.99).kind).toBe('sature');
    expect(toDb(1)).toBe(0);
    expect(Math.round(toDb(0.1))).toBe(-20);
    expect(toDb(0)).toBe(-90);
  });
  it('describes the room', () => {
    expect(roomLabel(-62)).toBe('Pièce calme');
    expect(roomLabel(-50)).toBe('Un peu de bruit de fond');
    expect(roomLabel(-35)).toMatch(/bruyante/);
  });
  it('names a strummed chord, not a single note', () => {
    expect(guessChord({ c: chromaOf({ 4: 0.45, 7: 0.25, 11: 0.3 }), bass: 4 })).toBe('Em');
    expect(guessChord({ c: chromaOf({ 9: 0.4, 1: 0.25, 4: 0.35 }), bass: 9 })).toBe('A');
    expect(guessChord({ c: chromaOf({ 7: 0.3, 11: 0.25, 2: 0.25, 5: 0.2 }), bass: 7 })).toBe('G7');
    // A single note with its fifth harmonic is not a chord.
    expect(guessChord({ c: chromaOf({ 4: 0.8, 11: 0.2 }), bass: 4 })).toBeNull();
    expect(heard(chromaOf({ 4: 0.8, 11: 0.2 }))).toEqual([4, 11]);
  });
});
