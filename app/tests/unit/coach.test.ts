import { describe, expect, it } from 'vitest';
import { coachRoutine, countChanges, levels, levelFromChanges, levelFromRhythm, levelFromScale, strumSpread, type Profile } from '../../src/lib/coach';
import { detectOnsets } from '../../src/lib/onsets';

const profile = (p: Partial<Profile> = {}): Profile => ({ goals: ['chords', 'solo'], styles: ['blues'], minutes: 30, measures: {}, declared: {}, date: 0, ...p });

describe('levels', () => {
  it('from the three tests', () => {
    expect([10, 15, 34, 35].map(levelFromChanges)).toEqual([1, 2, 2, 3]);
    expect([60, 70, 109, 110].map(levelFromScale)).toEqual([1, 2, 2, 3]);
    expect([60, 45, 21, 20].map(levelFromRhythm)).toEqual([1, 2, 2, 3]);
  });
  it('a skipped test takes the level the player gave, else beginner', () => {
    expect(levels({ measures: { changes: 40 }, declared: { rhythm: 2 } })).toEqual({ chords: 3, technique: 1, rhythm: 2 });
  });
});

describe('the tests’ measures', () => {
  it('one-minute changes: alternations held a moment; flickers and other chords do not count', () => {
    const C = 'C', G = 'G';
    expect(countChanges([C, C, G, G, C, C, G, G], C, G)).toBe(3);
    expect(countChanges([C, C, G, C, null, C, G, G, 'Am', G], C, G)).toBe(1); // a single G frame is not a change
    expect(countChanges([C, C, C, null, C, C], C, G)).toBe(0);
  });
  it('strum timing: the spread around the click, whatever the device latency', () => {
    const clicks = Array.from({ length: 20 }, (_, i) => i * 0.75);
    const tight = clicks.map((c, i) => c + 0.12 + (i % 2 ? 0.005 : -0.005)); // 120 ms latency, ±5 ms
    expect(strumSpread(tight, clicks)!.spread).toBeLessThanOrEqual(6);
    const loose = clicks.map((c, i) => c + [0, 0.06, -0.05, 0.04, -0.07][i % 5]);
    expect(strumSpread(loose, clicks)!.spread).toBeGreaterThan(40);
    expect(strumSpread([0.1, 5], clicks)).toBeNull(); // hardly any strum heard
  });
  it('onsets of plucked notes, found within 10 ms', () => {
    const sr = 48000, at = [0.3, 1.05, 1.8, 2.55];
    const x = new Float32Array(sr * 3);
    for (let i = 0; i < x.length; i++) x[i] = (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.002;
    for (const t of at) for (let i = 0; i < sr * 0.5; i++) x[Math.round(t * sr) + i] += Math.sin((2 * Math.PI * 196 * i) / sr) * Math.exp(-i / (sr * 0.15)) * 0.5;
    const found = detectOnsets(x, sr, 10);
    expect(found.length).toBe(4);
    found.forEach((f, k) => expect(Math.abs(f - (10 + at[k]))).toBeLessThan(0.01));
  });
});

describe('the routine of the day', () => {
  const total = (p: Profile, day = 1) => coachRoutine(p, day).reduce((t, s) => t + s.min, 0);
  it('fits exactly in the time chosen, warm-up first', () => {
    for (const minutes of [10, 20, 30, 45] as const) {
      const r = coachRoutine(profile({ minutes }), 3);
      expect(r.reduce((t, s) => t + s.min, 0)).toBe(minutes);
      expect(r[0].name).toBe('Échauffement');
      expect(r.every(s => s.min >= 2 && s.detail.length > 20 && s.short.length > 0)).toBe(true);
    }
    expect(total(profile({ goals: ['chords', 'rhythm', 'solo', 'songs', 'singing'], minutes: 45 }))).toBe(45);
  });
  it('adapted to the level: a beginner’s exercises are not an advanced player’s', () => {
    const beg = coachRoutine(profile({ measures: { changes: 8, scaleBpm: 55 } }), 2);
    const adv = coachRoutine(profile({ measures: { changes: 45, scaleBpm: 130 } }), 2);
    expect(beg.find(s => s.name === 'Gammes')!.detail).toMatch(/position 1, en noires/);
    expect(adv.find(s => s.name === 'Gammes')!.detail).toMatch(/5 positions/);
    expect(beg.find(s => s.name === 'Accords')!.detail).toMatch(/Visez 13/);
  });
  it('the weakest skill comes first after the warm-up, with more time', () => {
    const r = coachRoutine(profile({ goals: ['chords', 'rhythm'], minutes: 30, measures: { changes: 40, rhythmMs: 60, scaleBpm: 120 } }), 4);
    expect(r[1].name).toBe('Rythme');
    expect(r[1].min).toBeGreaterThan(r[2].min);
  });
  it('tools open set up for the exercise: tempo from the test, the style’s backing track', () => {
    const r = coachRoutine(profile({ styles: ['rock'], measures: { scaleBpm: 100 } }), 1);
    const scales = r.find(s => s.name === 'Gammes')!;
    expect(scales.link!.set).toMatchObject({ 'scale.key': 4, 'metro.bpm': 90 });
    expect(r.find(s => s.name === 'Impro')!.link!.set).toMatchObject({ 'backing.sel': 'r1' });
  });
  it('changes from one day to the next, and goals take turns when time is short', () => {
    const p = profile({ goals: ['chords', 'rhythm', 'songs'], minutes: 10 });
    const names = [0, 1, 2].map(d => coachRoutine(p, d).map(s => s.name).join(','));
    expect(new Set(names).size).toBeGreaterThan(1);
    expect(coachRoutine(p, 0).length).toBe(3); // warm-up + 2 blocks in 10 minutes
  });
});
