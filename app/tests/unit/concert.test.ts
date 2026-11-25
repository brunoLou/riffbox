import { describe, expect, it } from 'vitest';
import { DEFAULT_CHECKLIST, checklistOf, setTimeline } from '../../src/lib/setlists';

describe('concert sheet', () => {
  it('each song’s start in the set, gaps between songs (not after the last)', () => {
    expect(setTimeline([180, 240, 200], 30)).toEqual({ starts: [0, 210, 480], total: 680 });
    expect(setTimeline([], 30)).toEqual({ starts: [], total: 0 });
    expect(setTimeline([100], 60).total).toBe(100);
  });
  it('a ready checklist until the player changes it', () => {
    const c = checklistOf({ id: 's', name: 'Set', songIds: [] });
    expect(c.map(x => x.text)).toEqual(DEFAULT_CHECKLIST);
    expect(c.every(x => !x.done)).toBe(true);
    expect(checklistOf({ id: 's', name: 'Set', songIds: [], checklist: [{ id: 'a', text: 'Capo', done: true }] })).toHaveLength(1);
  });
});
