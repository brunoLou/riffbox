import { describe, expect, it } from 'vitest';
import { chordNotes, chordShow, diatonic, keyFr, levelKinds, makeTheoryQuestion, noteFr, parseTChord, recordTheory, theorySummary, type TheoryLevel } from '../../src/lib/theory';

const notes = (s: string) => chordNotes(parseTChord(s)!).map(noteFr).join(' ');

describe('spelling', () => {
  it('spells chord notes from their letters', () => {
    expect(notes('E')).toBe('Mi Sol♯ Si');
    expect(notes('Bb')).toBe('Si♭ Ré Fa');
    expect(notes('F#m')).toBe('Fa♯ La Do♯');
    expect(notes('Cm')).toBe('Do Mi♭ Sol');
    expect(notes('B7')).toBe('Si Ré♯ Fa♯ La');
    expect(notes('Fmaj7')).toBe('Fa La Do Mi');
  });
  it('the chords of a key are written in that key', () => {
    expect(diatonic(5).map(chordShow)).toEqual(['F', 'Gm', 'Am', 'B♭', 'C', 'Dm']);
    expect(diatonic(2).map(chordShow)).toEqual(['D', 'Em', 'F♯m', 'G', 'A', 'Bm']);
    expect(diatonic(3).map(chordShow)).toEqual(['E♭', 'Fm', 'Gm', 'A♭', 'B♭', 'Cm']);
    expect(keyFr(10)).toBe('Si♭ majeur');
  });
});

describe('questions', () => {
  // A small seeded random, so the test is the same every time.
  const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  it('four distinct choices, the answer among them, for every kind and level', () => {
    for (const lv of [1, 2, 3] as TheoryLevel[]) {
      for (const kind of levelKinds(lv)) {
        const r = rng(lv * 100 + kind.length);
        for (let i = 0; i < 150; i++) {
          const q = makeTheoryQuestion(lv, r, kind);
          expect(q.choices, `${kind} niveau ${lv} : ${q.prompt}`).toHaveLength(4);
          expect(new Set(q.choices).size).toBe(4);
          expect(q.choices).toContain(q.answer);
        }
      }
    }
  });
  it('gives the right answers', () => {
    const r = rng(7);
    for (let i = 0; i < 60; i++) {
      const q = makeTheoryQuestion(3, r, 'capo');
      const m = q.prompt.match(/case (\d+), vous jouez une forme de .* \((.+)\)/)!;
      const shape = parseTChord(m[2].replace('♭', 'b').replace('♯', '#'))!;
      const sounding = parseTChord(q.answer.match(/\((.+)\)$/)![1].replace('♭', 'b').replace('♯', '#'))!;
      expect((shape.root.pc + Number(m[1])) % 12).toBe(sounding.root.pc);
    }
    const rel = makeTheoryQuestion(1, () => 0.1, 'relative');
    expect(rel.prompt).toBe('Quel est le relatif mineur de Do majeur ?');
    expect(rel.answer).toBe('La mineur');
    const k = makeTheoryQuestion(3, rng(3), 'key');
    expect(k.chords).toHaveLength(4);
  });
  it('explains the third right (major, minor, seventh)', () => {
    const r = rng(11);
    for (let i = 0; i < 120; i++) {
      const q = makeTheoryQuestion(3, r, 'notes');
      const c = parseTChord(q.prompt.match(/\((.+)\) \?$/)![1].replace('♭', 'b').replace('♯', '#'))!;
      const minor = ['m', 'm7'].includes(c.type.id);
      expect(q.explain, q.prompt).toContain(minor ? 'tierce mineure' : 'tierce majeure');
    }
  });
  it('keeps scores per kind and finds the weakest', () => {
    let s = {};
    for (let i = 0; i < 4; i++) s = recordTheory(s, 'capo', i === 0);
    for (let i = 0; i < 4; i++) s = recordTheory(s, 'notes', true);
    expect(theorySummary(s)).toEqual({ n: 8, rate: 63, weakest: 'capo' });
  });
});
