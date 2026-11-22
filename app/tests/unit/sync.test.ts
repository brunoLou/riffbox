import { beforeEach, describe, expect, it } from 'vitest';
import '../../src/lib/ideas'; // registers the serializer that strips playback URLs
import { clearAllStored, readStored, writeStored } from '../../src/lib/store';
import { DELETED_KEY, installSync, mergeSummary, planMerge, stampList } from '../../src/lib/sync';

installSync();
beforeEach(() => clearAllStored());

const song = (id: string, title: string, updated?: number) => ({ id, title, ...(updated !== undefined ? { updated } : {}) });

describe('dates of change', () => {
  it('a new or changed item is dated, an unchanged one keeps its date', () => {
    const v1 = stampList('songs', [song('a', 'A', 100), song('b', 'B', 100)], [song('a', 'A', 100), song('b', 'B2', 100), song('c', 'C')], 500);
    expect(v1.map(x => x.updated)).toEqual([100, 500, 500]);
  });
  it('a copy without its date (screen state) keeps the date it had', () => {
    expect(stampList('songs', [song('a', 'A', 100)], [song('a', 'A')], 500)[0].updated).toBe(100);
  });
  it('a playback URL appearing on a recording is not a change', () => {
    const idea = { id: 'i', title: 'Riff', kind: 'riff', created: 1, updated: 100 };
    expect(stampList('ideas', [idea], [{ ...idea, audioUrl: 'blob:x' } as never], 500)[0].updated).toBe(100);
  });
  it('every write through the store is dated, and a deletion is remembered', () => {
    writeStored('songs', [song('a', 'A'), song('b', 'B')]);
    const [a] = readStored<{ id: string; updated: number }[]>('songs', []);
    expect(a.updated).toBeGreaterThan(0);
    writeStored('songs', [readStored<object[]>('songs', [])[0]]);
    expect(Object.keys(readStored(DELETED_KEY, {}))).toEqual(['songs:b']);
  });
});

describe('receiving the other device’s data', () => {
  const mine = (data: Record<string, unknown>) => (k: string) => data[k];

  it('new items join, the newer version wins, an older one is ignored', () => {
    const here = { songs: [song('a', 'A here', 300), song('b', 'B here', 300)] };
    const there = { songs: [song('a', 'A there', 400), song('b', 'B there', 200), song('c', 'C', 100)] };
    const plan = planMerge(there, mine(here));
    expect((plan.writes.songs as { title: string }[]).map(x => x.title)).toEqual(['A there', 'B here', 'C']);
    expect(plan.stats).toEqual({ added: 1, updated: 1, removed: 0 });
    expect(mergeSummary(plan.stats)).toBe('Éléments : 1 ajouté et 1 mis à jour');
  });

  it('deleted there after the last change here: deleted here too', () => {
    const plan = planMerge({ songs: [], [DELETED_KEY]: { 'songs:a': 500 } }, mine({ songs: [song('a', 'A', 300), song('b', 'B', 300)] }));
    expect((plan.writes.songs as { id: string }[]).map(x => x.id)).toEqual(['b']);
    expect(plan.stats.removed).toBe(1);
  });

  it('changed here after the other device deleted it: kept', () => {
    const plan = planMerge({ songs: [], [DELETED_KEY]: { 'songs:a': 200 } }, mine({ songs: [song('a', 'A', 300)] }));
    expect(plan.writes.songs).toBeUndefined();
  });

  it('deleted here: the other device’s copy does not bring it back', () => {
    const plan = planMerge({ songs: [song('a', 'A', 300)] }, mine({ songs: [], [DELETED_KEY]: { 'songs:a': 400 } }));
    expect(plan.writes.songs).toBeUndefined();
    expect(plan.stats).toEqual({ added: 0, updated: 0, removed: 0 });
  });

  it('deletions travel on: they are kept for the next transfer', () => {
    const plan = planMerge({ songs: [], [DELETED_KEY]: { 'songs:x': Date.now() } }, mine({ songs: [] }));
    expect(plan.writes[DELETED_KEY]).toHaveProperty('songs:x');
  });

  it('the examples count as data here before they were ever saved', () => {
    const plan = planMerge({ ideas: [], [DELETED_KEY]: { 'ideas:i1': Date.now() } }, mine({}), { ideas: [{ id: 'i1', title: 'Ex', created: 1 }, { id: 'i3', title: 'Ex2', created: 1 }] });
    expect((plan.writes.ideas as { id: string }[]).map(x => x.id)).toEqual(['i3']);
  });

  it('recordings come with new and newer ideas only', () => {
    const plan = planMerge({ ideas: [{ id: 'n', title: 'New', created: 500 }, { id: 'o', title: 'Old', created: 1, updated: 1 }] }, mine({ ideas: [{ id: 'o', title: 'Old here', created: 1, updated: 50 }] }));
    expect(plan.audioIds).toEqual(['n']);
  });

  it('practice minutes: the larger per day; device settings stay', () => {
    const plan = planMerge(
      { 'practice.log': { '2026-11-20': 30, '2026-11-21': 10 }, 'settings.theme': 'light', 'home.layout': [] },
      mine({ 'practice.log': { '2026-11-20': 20, '2026-11-21': 15 }, 'settings.theme': 'dark' }),
    );
    expect(plan.writes['practice.log']).toEqual({ '2026-11-20': 30, '2026-11-21': 15 });
    expect(plan.writes).not.toHaveProperty('settings.theme');
    expect(plan.writes).not.toHaveProperty('home.layout');
  });

  it('a single value (the routine) follows its most recent change', () => {
    const steps = [{ id: 's', name: 'Gammes', min: 5 }];
    expect(planMerge({ 'routine.steps': steps, 'sync.valueTimes': { 'routine.steps': 900 } }, mine({ 'routine.steps': [], 'sync.valueTimes': { 'routine.steps': 100 } })).writes['routine.steps']).toEqual(steps);
    expect(planMerge({ 'routine.steps': steps, 'sync.valueTimes': { 'routine.steps': 50 } }, mine({ 'routine.steps': [], 'sync.valueTimes': { 'routine.steps': 100 } })).writes).not.toHaveProperty('routine.steps');
  });

  it('the examples’ creation time differs on each device: not a change', () => {
    const plan = planMerge({ ideas: [{ id: 'i1', title: 'Ex', created: 900, updated: 900 }] }, mine({ ideas: [{ id: 'i1', title: 'Ex', created: 100, updated: 100 }] }));
    expect(plan.stats.updated).toBe(0);
  });

  it('receiving the same data twice changes nothing', () => {
    const here = { songs: [song('a', 'A', 300)] };
    expect(planMerge(here, mine(here)).writes).toEqual({});
    expect(mergeSummary(planMerge(here, mine(here)).stats)).toBe('Déjà à jour : rien de nouveau');
  });
});
