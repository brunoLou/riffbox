import { describe, expect, it } from 'vitest';
import { deleteSection, groupSlots, moveToSection, placeNear, shiftSection, type Section } from '../../src/lib/homeBoard';
import type { Slot } from '../../src/lib/data';

const secs: Section[] = [{ id: 'a', name: 'Outils' }, { id: 'b', name: 'Entraînement' }];
const L: Slot[] = [
  { id: 'tuner', wide: false, sec: 'a' }, { id: 'metro', wide: false },
  { id: 'capo', wide: false, sec: 'a' }, { id: 'routine', wide: false, sec: 'b' }, { id: 'voix', wide: false, sec: 'gone' },
];
const ids = (g: { slots: Slot[] }) => g.slots.map(s => s.id);

describe('home compartments', () => {
  it('groups unsorted pedals first, then each compartment; unknown compartments count as unsorted', () => {
    const g = groupSlots(L, secs);
    expect(g.map(ids)).toEqual([['metro', 'voix'], ['tuner', 'capo'], ['routine']]);
    expect(g.map(x => x.name)).toEqual([null, 'Outils', 'Entraînement']);
  });
  it('a board without compartments stays one group', () => {
    expect(groupSlots(L.map(({ sec: _s, ...r }) => r), []).map(ids)).toEqual([['tuner', 'metro', 'capo', 'routine', 'voix']]);
  });
  it('placing next to a pedal takes its compartment', () => {
    const n = placeNear(L, 'metro', 'routine', false, secs);
    expect(groupSlots(n, secs).map(ids)).toEqual([['voix'], ['tuner', 'capo'], ['metro', 'routine']]);
    const back = placeNear(n, 'metro', 'voix', true, secs);
    expect(back.find(s => s.id === 'metro')!.sec).toBeUndefined();
  });
  it('moves to the end of a compartment, and back to unsorted', () => {
    expect(ids(groupSlots(moveToSection(L, 'metro', 'a'), secs)[1])).toEqual(['tuner', 'capo', 'metro']);
    expect(moveToSection(L, 'tuner', '').find(s => s.id === 'tuner')!.sec).toBeUndefined();
  });
  it('deleting a compartment keeps its pedals', () => {
    const r = deleteSection(L, secs, 'a');
    expect(r.sections.map(s => s.id)).toEqual(['b']);
    expect(r.layout).toHaveLength(L.length);
    expect(ids(groupSlots(r.layout, r.sections)[0])).toEqual(['tuner', 'metro', 'capo', 'voix']);
  });
  it('reorders compartments', () => {
    expect(shiftSection(secs, 'b', -1).map(s => s.id)).toEqual(['b', 'a']);
    expect(shiftSection(secs, 'a', -1)).toBe(secs);
  });
});
