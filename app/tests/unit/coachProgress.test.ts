import { describe, expect, it } from 'vitest';
import { coachRoutine, type Profile } from '../../src/lib/coach';
import { compareCheckups, exOfStep, monthlyDue, nextBpm, recordFeel, weekReview, type Progress } from '../../src/lib/coachProgress';

const profile: Profile = { goals: ['rhythm', 'solo'], styles: ['blues'], minutes: 30, measures: { scaleBpm: 80 }, declared: {}, date: 0 };

describe('the coach over time', () => {
  it('tempo: easy → +4, hard → −4, « juste » twice in a row → +2, within 40–200', () => {
    expect(nextBpm(80, 'easy', undefined)).toBe(84);
    expect(nextBpm(80, 'hard', 'easy')).toBe(76);
    expect(nextBpm(80, 'ok', 'easy')).toBe(80);
    expect(nextBpm(80, 'ok', 'ok')).toBe(82);
    expect(nextBpm(198, 'easy', undefined)).toBe(200);
    expect(nextBpm(42, 'hard', undefined)).toBe(40);
  });

  it('records one answer per exercise and day (a second one replaces it)', () => {
    let p: Progress = {};
    p = recordFeel(p, 'rhythm', 90, 'easy', 100);
    expect(p.rhythm!.bpm).toBe(94);
    p = recordFeel(p, 'rhythm', 94, 'hard', 100); // same day: still played at 90
    expect(p.rhythm).toEqual({ bpm: 86, history: [{ day: 100, bpm: 90, feel: 'hard' }] });
    p = recordFeel(p, 'rhythm', 86, 'ok', 101);
    p = recordFeel(p, 'rhythm', 86, 'ok', 102);
    expect(p.rhythm!.bpm).toBe(88);
    expect(exOfStep('coach-technique')).toBe('technique');
    expect(exOfStep('coach-impro')).toBeNull();
    expect(exOfStep('warm')).toBeNull();
  });

  it('the next routine uses the tempos reached', () => {
    const before = coachRoutine(profile, 5);
    const after = coachRoutine(profile, 5, { technique: { bpm: 96, history: [] }, rhythm: { bpm: 77, history: [] } });
    const tech = after.find(s => s.id === 'coach-technique')!;
    expect(tech.detail).toContain('à 96 BPM');
    expect(tech.link!.set!['metro.bpm']).toBe(96);
    const rhythm = after.find(s => s.id === 'coach-rhythm')!;
    expect(rhythm.detail).toContain('Tempo du jour : 77 BPM.');
    expect(rhythm.link!.set!['metro.bpm']).toBe(77);
    expect(after.map(s => s.min)).toEqual(before.map(s => s.min));
  });

  it('weekly review: minutes, days, tempos gained and advice', () => {
    const p: Progress = { rhythm: { bpm: 98, history: [{ day: 95, bpm: 90, feel: 'easy' }, { day: 98, bpm: 94, feel: 'easy' }] } };
    const w = weekReview(p, [20, 0, 30, 25, 0, 15, 20], 100);
    expect(w).toMatchObject({ minutes: 110, days: 5, tempos: [{ ex: 'rhythm', from: 90, to: 98 }] });
    expect(w.advice).toContain('rythme +8 BPM');
    expect(weekReview({}, [0, 0, 10, 0, 0, 0, 0], 100).advice).toContain('visez 5 jours');
    const hard: Progress = { technique: { bpm: 72, history: [{ day: 97, bpm: 80, feel: 'hard' }, { day: 99, bpm: 76, feel: 'hard' }] } };
    expect(weekReview(hard, [10, 10, 10, 10, 10, 0, 0], 100).advice).toContain('Gammes vous résiste');
  });

  it('monthly test four weeks after the last check-up, and what changed', () => {
    const d = 86400000;
    expect(monthlyDue(0, 27 * d)).toEqual({ due: false, inDays: 1 });
    expect(monthlyDue(0, 28 * d)).toEqual({ due: true, inDays: 0 });
    const c = compareCheckups({ changes: 12, scaleBpm: 70, rhythmMs: 40 }, { changes: 20, scaleBpm: 70, rhythmMs: 25 });
    expect(c.map(x => [x.skill, x.better])).toEqual([['chords', true], ['technique', false], ['rhythm', true]]);
    expect(compareCheckups({ changes: 12 }, { scaleBpm: 80 })).toEqual([]);
  });
});
