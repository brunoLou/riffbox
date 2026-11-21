import { describe, expect, it } from 'vitest';
import {
  CHORD_TYPES, OPEN_MIDI, STRING_SETS, chordType, fingering, hasInversions, inversions, setsFor, slashName, voicings, type Voicing,
} from '../../src/lib/chords';
import { mod12 } from '../../src/lib/music';

const open = (root: number, id: string) => voicings(root, chordType(id)).find(v => v.base === 1 && v.frets.includes(0))!;
const f = (v: Voicing) => fingering(v).fingers;

describe('fingering: the usual open chords', () => {
  it('C, G, D, A, E, Am, Em, Dm', () => {
    expect(f(open(0, 'maj'))).toEqual([null, 3, 2, 0, 1, 0]);
    expect(f(open(7, 'maj'))).toEqual([2, 1, 0, 0, 0, 3]);
    expect(f(open(2, 'maj'))).toEqual([null, null, 0, 1, 3, 2]);
    expect(f(open(9, 'maj'))).toEqual([null, 0, 1, 2, 3, 0]);
    expect(f(open(4, 'maj'))).toEqual([0, 2, 3, 1, 0, 0]);
    expect(f(open(9, 'm'))).toEqual([null, 0, 2, 3, 1, 0]);
    expect(f(open(4, 'm'))).toEqual([0, 1, 2, 0, 0, 0]);
    expect(f(open(2, 'm'))).toEqual([null, null, 0, 2, 3, 1]);
  });
  it('no barre on open chords', () => {
    expect(fingering(open(9, 'maj')).barre).toBeNull();
  });
});

describe('fingering: barre chords', () => {
  it('F, E shape: index across, 2 on G, 3 and 4 on A and D', () => {
    const F = voicings(5, chordType('maj')).find(v => v.shape === 'E')!;
    expect(F.frets).toEqual([1, 3, 3, 2, 1, 1]);
    expect(fingering(F)).toEqual({ fingers: [1, 3, 4, 2, 1, 1], barre: { fret: 1, from: 0, to: 5 } });
  });
  it('B flat, A shape', () => {
    const Bb = voicings(10, chordType('maj')).find(v => v.shape === 'A')!;
    expect(Bb.frets).toEqual([null, 1, 3, 3, 3, 1]);
    expect(fingering(Bb)).toEqual({ fingers: [null, 1, 2, 3, 4, 1], barre: { fret: 1, from: 1, to: 5 } });
  });
});

describe('fingering: every voicing of the library can be played', () => {
  for (const type of CHORD_TYPES) {
    it(type.fr, () => {
      for (let root = 0; root < 12; root++) {
        const all = [...voicings(root, type), ...setsFor(type).flatMap(s => inversions(root, type, s.i))];
        for (const v of all) {
          const { fingers, barre } = fingering(v);
          const used = fingers.filter((x): x is number => x !== null && x > 0);
          expect(Math.max(0, ...used), JSON.stringify(v.frets)).toBeLessThanOrEqual(4);
          // A finger holds several strings only across neighbouring strings on one fret (a barre).
          for (const fg of [1, 2, 3, 4]) {
            const on = fingers.map((x, s) => (x === fg ? s : -1)).filter(s => s >= 0);
            if (on.length < 2) continue;
            const frets = new Set(on.map(s => v.frets[s]));
            expect(frets.size, JSON.stringify(v.frets)).toBe(1);
            if (!(barre && fg === 1)) expect(on[on.length - 1] - on[0], JSON.stringify(v.frets)).toBe(on.length - 1);
          }
          // A higher finger never sits on a lower fret.
          for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) {
            const fa = fingers[a], fb = fingers[b];
            if (fa && fb && fa < fb) expect(v.frets[a]!, JSON.stringify(v.frets)).toBeLessThanOrEqual(v.frets[b]!);
          }
        }
      }
    });
  }
});

describe('inversions', () => {
  it('C major on the top three strings: root position, then E and G in the bass', () => {
    const list = inversions(0, chordType('maj'), 0);
    expect(list.map(v => v.inv)).toEqual([0, 1, 2]);
    expect(list.map(v => slashName(0, chordType('maj'), v))).toEqual(['C', 'C/E', 'C/G']);
  });

  it('every three- and four-note chord, on every string group and root: inversions with all tones, within five frets', () => {
    let n = 0;
    const missing: string[] = [];
    for (const type of CHORD_TYPES.filter(hasInversions)) {
      for (const set of setsFor(type)) {
        for (let root = 0; root < 12; root++) {
          const list = inversions(root, type, set.i);
          if (list.length !== type.ivs.length) missing.push(`${root} ${type.id} ${set.label}`);
          for (const v of list) {
            const strings = STRING_SETS[set.i].strings;
            const pcs = strings.map(s => mod12(OPEN_MIDI[s] + v.frets[s]!));
            expect(new Set(pcs)).toEqual(new Set(type.ivs.map(([iv]) => mod12(root + iv))));
            expect(pcs[0]).toBe(mod12(root + type.ivs[v.inv!][0]));
            const fr = strings.map(s => v.frets[s]!).filter(x => x > 0);
            if (fr.length) expect(Math.max(...fr) - Math.min(...fr)).toBeLessThanOrEqual(4);
            n++;
          }
        }
      }
    }
    expect(n).toBeGreaterThan(2000);
    // The only gaps: no playable close voicing below fret 15 (4 of 612 chord / string-group pairs).
    expect(missing.sort()).toEqual(['0 dim La · Ré · Sol', '7 dim Mi · La · Ré', '6 maj7 La · Ré · Sol · Si', '1 maj7 Mi · La · Ré · Sol'].sort());
  });

  it('power chords and ninths have none', () => {
    expect(hasInversions(chordType('5'))).toBe(false);
    expect(hasInversions(chordType('9'))).toBe(false);
  });
});
