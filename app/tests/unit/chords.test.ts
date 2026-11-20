import { describe, expect, it } from 'vitest';
import { CHORD_TYPES, chordSymbol, intervalOf, voicingMidi, voicings } from '../../src/lib/chords';
import { mod12 } from '../../src/lib/music';

describe('chord library', () => {
  for (const type of CHORD_TYPES) {
    it(`every ${type.fr} voicing is playable and complete, in all 12 keys`, () => {
      const allowed = new Set(type.ivs.map(([s]) => s));
      const required = type.ivs.map(([s]) => s).filter(s => !(type.optional ?? []).includes(s));
      for (let root = 0; root < 12; root++) {
        const list = voicings(root, type);
        expect(list.length, chordSymbol(root, type)).toBeGreaterThanOrEqual(Math.min(2, type.templates.length));
        for (const v of list) {
          const pcs = voicingMidi(v).map(m => mod12(m - root));
          const where = `${chordSymbol(root, type)} ${v.shape} ${v.frets.map(f => f ?? 'x').join(' ')}`;
          expect(pcs.filter(p => !allowed.has(p)), `${where}: foreign notes`).toEqual([]);
          expect(required.filter(r => !pcs.includes(r)), `${where}: missing notes`).toEqual([]);
          expect(pcs[0], `${where}: root in the bass`).toBe(0);
          const fretted = v.frets.filter((f): f is number => f !== null && f > 0);
          if (fretted.length) expect(Math.max(...fretted) - Math.min(...fretted), `${where}: stretch`).toBeLessThanOrEqual(4);
          expect(Math.max(...v.frets.filter((f): f is number => f !== null)), where).toBeLessThanOrEqual(15);
        }
      }
    });
  }

  it('offers the five CAGED shapes for the main chords', () => {
    for (const id of ['maj', 'm', '7', 'maj7', 'm7']) {
      const type = CHORD_TYPES.find(t => t.id === id)!;
      expect(voicings(9, type).map(v => v.shape).sort()).toEqual(['A', 'C', 'D', 'E', 'G']);
    }
  });

  it('knows the open shapes', () => {
    const maj = CHORD_TYPES.find(t => t.id === 'maj')!;
    expect(voicings(0, maj).find(v => v.shape === 'C')!.frets).toEqual([null, 3, 2, 0, 1, 0]);
    expect(voicings(4, maj).find(v => v.shape === 'E')!.frets).toEqual([0, 2, 2, 1, 0, 0]);
  });

  it('labels intervals', () => {
    const seventh = CHORD_TYPES.find(t => t.id === '7')!;
    expect(intervalOf(0, seventh, 10)).toBe('♭7');
    expect(intervalOf(0, seventh, 2)).toBeNull();
  });
});
