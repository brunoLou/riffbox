import { describe, expect, it } from 'vitest';

describe('trainer', () => {
  it('the tempo rises every N bars up to the target, from the starting tempo', async () => {
    const { trainerBpm } = await import('../../src/lib/metronome');
    const t = { on: true, step: 4, every: 2, to: 100 };
    expect([1, 2, 3, 4, 5, 6].map(b => trainerBpm(90, t, b))).toEqual([90, 90, 94, 94, 98, 98]);
    expect(trainerBpm(90, t, 50)).toBe(100);
    expect(trainerBpm(90, { ...t, on: false }, 9)).toBe(90);
    expect(trainerBpm(120, { ...t, to: 100 }, 9)).toBe(120); // target below the start: stays
  });
  it('silent bars: play N, cut M, again', async () => {
    const { isSilentBar } = await import('../../src/lib/metronome');
    const g = { on: true, play: 2, mute: 1 };
    expect([1, 2, 3, 4, 5, 6, 7].map(b => isSilentBar(g, b))).toEqual([false, false, true, false, false, true, false]);
    expect(isSilentBar({ ...g, on: false }, 3)).toBe(false);
  });
});
