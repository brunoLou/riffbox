import { describe, expect, it } from 'vitest';
import { STR_PC, mod12 } from '../../src/lib/music';
import { SCALE_DEFS, ivLabel, listenNotes, positions, relatedLine, scaleDef } from '../../src/lib/scales';

describe('scale positions', () => {
  for (const def of SCALE_DEFS) {
    it(`${def.fr}: every position holds every degree, in all 12 keys`, () => {
      for (let key = 0; key < 12; key++) {
        const ps = positions(def, key);
        expect(ps.length).toBe(def.id === 'locrien' ? 3 : 5);
        for (const p of ps) {
          const found = new Set<number>();
          let width = 0;
          for (const [si, [a, b]] of Object.entries(p.box)) {
            width = Math.max(width, b - a);
            for (let f = a; f <= b; f++) { const iv = mod12(STR_PC[+si] + f - key); if (def.iv.includes(iv)) found.add(iv); }
          }
          expect(def.iv.filter(i => !found.has(i)), `${def.id} key ${key} position ${p.label}`).toEqual([]);
          expect(width).toBeLessThanOrEqual(6);
        }
      }
    });
  }
});

describe('scale names and relations', () => {
  it('relates modes to their parent major scale', () => {
    expect(relatedLine(scaleDef('dorien'), 9)).toBe('mêmes notes que Sol majeur');
    expect(relatedLine(scaleDef('mixo'), 7)).toBe('mêmes notes que Do majeur');
    expect(relatedLine(scaleDef('locrien'), 9)).toBe('mêmes notes que Si♭ majeur');
    expect(relatedLine(scaleDef('pmin'), 9)).toBe('mêmes notes que Do penta majeure');
  });
  it('calls the lydian fourth ♯4', () => {
    expect(ivLabel(scaleDef('lydien'), 6)).toBe('♯4');
    expect(ivLabel(scaleDef('blues'), 6)).toBe('♭5');
  });
  it('plays one octave up and back', () => {
    const notes = listenNotes(scaleDef('pmin'), 9, false);
    expect(notes[0]).toBe(notes[notes.length - 1]);
    expect(Math.max(...notes) - notes[0]).toBe(12);
    expect(listenNotes(scaleDef('pmin'), 9, true).length).toBe(notes.length + 2);
  });
});
