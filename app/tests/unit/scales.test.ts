import { describe, expect, it } from 'vitest';
import { STR_PC, mod12 } from '../../src/lib/music';
import { SCALE_DEFS, ivLabel, listenNotes, positions, relatedLine, scaleDef, slideForms, TREBLE } from '../../src/lib/scales';

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

describe('sliding forms on the three treble strings', () => {
  const pc = (p: number) => ((p % 12) + 12) % 12;
  it('A minor pentatonic: five forms, two consecutive scale notes per string, climbing the neck', () => {
    const forms = slideForms(scaleDef('pmin'), 9);
    expect(forms.map(f => f.label)).toEqual(['↗1', '↗2', '↗3', '↗4', '↗5']);
    // Each starts on a different degree, and the forms climb the neck.
    expect(new Set(forms.map(f => pc(f.notes[0]))).size).toBe(5);
    const starts = forms.map(f => f.box[3][0]);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    for (const f of forms) {
      expect(f.notes).toHaveLength(6);
      expect(f.notes.every(p => [0, 3, 5, 7, 10].includes(pc(p - 9)))).toBe(true);
      // Two notes on each of G, B, e, from low to high, within the neck.
      expect(Object.keys(f.box).map(Number)).toEqual([3, 4, 5]);
      TREBLE.forEach(([si, open], k) => expect(f.box[si]).toEqual([f.notes[2 * k] - open, f.notes[2 * k + 1] - open]));
      Object.values(f.box).forEach(([lo, hi]) => { expect(lo).toBeGreaterThanOrEqual(0); expect(hi).toBeLessThanOrEqual(17); expect(hi).toBeGreaterThan(lo); });
    }
    // The second form: A–C on G (frets 2–5), D–E on B (3–5), G–A on high e (3–5).
    expect(forms[1].box).toEqual({ 3: [2, 5], 4: [3, 5], 5: [3, 5] });
  });

  it('major pentatonic and blues have them too; the other scales do not', () => {
    expect(slideForms(scaleDef('pmaj'), 7)).toHaveLength(5);
    expect(slideForms(scaleDef('blues'), 4)).toHaveLength(5);
    expect(slideForms(scaleDef('dorien'), 2)).toEqual([]);
  });
});
