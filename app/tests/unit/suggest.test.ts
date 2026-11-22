import { describe, expect, it } from 'vitest';
import { chordType, voicings } from '../../src/lib/chords';
import { chordName, chordTypeId, sameChord, type Chord } from '../../src/lib/music';
import { romanOf, suggest } from '../../src/lib/suggest';

const C = 0;
const names = (cs: { chords: Chord[] }[]) => cs.map(s => s.chords.map(chordName).join(' '));

describe('chord colours', () => {
  it('names and types sevenths and suspensions', () => {
    expect(chordName({ pc: 7, x: '7' })).toBe('G7');
    expect(chordName({ pc: 9, m: true, x: '7' })).toBe('Am7');
    expect(chordName({ pc: 7, x: 'sus4' })).toBe('Gsus4');
    expect(chordTypeId({ pc: 9, m: true, x: '7' })).toBe('m7');
    expect(romanOf(C, { pc: 10 })).toBe('♭VII');
    expect(romanOf(C, { pc: 5, m: true })).toBe('iv');
    expect(romanOf(C, { pc: 7, x: 'sus4' })).toBe('Vsus4');
  });
});

describe('ideas for what comes next', () => {
  it('starting a section: the tonic first, then the relative minor', () => {
    expect(names(suggest(C, []).natural).slice(0, 2)).toEqual(['C', 'Am']);
  });
  it('after the dominant: home first, then the deceptive cadence', () => {
    const n = suggest(C, [{ pc: 0 }, { pc: 7 }]).natural;
    expect(names(n).slice(0, 2)).toEqual(['C', 'Am']);
    expect(n[1].why).toMatch(/trompeuse/);
  });
  it('a dominant seventh resolves a fourth up, a sus4 on its own chord', () => {
    expect(names(suggest(C, [{ pc: 4, x: '7' }]).natural)[0]).toBe('Am'); // E7 → Am
    expect(names(suggest(C, [{ pc: 0, x: '7' }]).natural)[0]).toBe('F'); // C7 → F
    expect(names(suggest(C, [{ pc: 7, x: 'sus4' }]).natural)[0]).toBe('G');
  });
  it('works in every key, transposed', () => {
    for (let k = 0; k < 12; k++) {
      const base = suggest(C, [{ pc: 5 }]);
      const here = suggest(k, [{ pc: (5 + k) % 12 }]);
      for (const f of ['natural', 'color', 'end'] as const) {
        expect(here[f].map(s => s.chords.map(c => (c.pc - k + 12) % 12))).toEqual(base[f].map(s => s.chords.map(c => c.pc)));
        expect(here[f].map(s => s.label)).toEqual(base[f].map(s => s.label));
      }
    }
  });
  it('never suggests the chord just played, nor the same chord twice across naturals and colours', () => {
    const cases: Chord[][] = [[], [{ pc: 0 }], [{ pc: 2, m: true }], [{ pc: 4, m: true }], [{ pc: 5 }], [{ pc: 7 }], [{ pc: 9, m: true }], [{ pc: 10 }], [{ pc: 8 }], [{ pc: 5, m: true }], [{ pc: 6 }]];
    for (const before of cases) {
      const s = suggest(C, before);
      const last = before[before.length - 1];
      const singles = [...s.natural, ...s.color].map(x => x.chords[0]);
      expect(singles.length).toBeGreaterThanOrEqual(5);
      singles.forEach((c, i) => {
        if (last) expect(sameChord(c, last), chordName(c)).toBe(false);
        expect(singles.findIndex(d => sameChord(c, d)), chordName(c)).toBe(i);
      });
    }
  });
  it('colours follow the context: after IV, the minor IV comes first', () => {
    expect(suggest(C, [{ pc: 5 }]).color[0]).toMatchObject({ label: 'iv', chords: [{ pc: 5, m: true }] });
  });
  it('endings: two-chord cadences, shortened when the section already sits on their first chord', () => {
    const e = suggest(C, [{ pc: 9, m: true }]).end;
    expect(names(e)).toEqual(['G7 C', 'F C', 'Fm C', 'Bb C', 'Gsus4 G']);
    expect(names(suggest(C, [{ pc: 5 }]).end)[1]).toBe('C');
  });
  it('every suggested chord has a playable shape and a diagram', () => {
    for (let k = 0; k < 12; k++) for (const before of [[], [{ pc: k }], [{ pc: (k + 7) % 12 }]] as Chord[][]) {
      const s = suggest(k, before);
      for (const c of [...s.natural, ...s.color, ...s.end].flatMap(x => x.chords)) {
        expect(voicings(c.pc, chordType(chordTypeId(c))).length, chordName(c)).toBeGreaterThan(0);
      }
    }
  });
});
