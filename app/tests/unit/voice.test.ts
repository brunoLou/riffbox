import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RANGE, MELODIES, WARMUPS, accuracy, average, buildTimeline, foldTo, noteFr, noteSci, pieceById, scorePhrases, targetAt,
  tonicFor, voiceType, type TracePoint,
} from '../../src/lib/voice';

const tl = buildTimeline(pieceById('clair-lune')!, 60);
function sing(shift: (m: number) => number | null): TracePoint[] {
  const out: TracePoint[] = [];
  for (let t = 0; t < tl.total; t += 0.05) { const m = targetAt(tl, t); out.push({ t, m: m === null ? null : shift(m) }); }
  return out;
}

describe('note names', () => {
  it('uses French octaves (La3 = 440 Hz) and scientific names', () => {
    expect(noteFr(69)).toBe('La3');
    expect(noteSci(69)).toBe('A4');
    expect(noteFr(60)).toBe('Do3');
  });
  it('folds octaves', () => {
    expect(foldTo(45, 57)).toBe(57);
    expect(foldTo(70, 57)).toBe(58);
  });
});

describe('scoring', () => {
  it('rewards singing in tune', () => expect(average(scorePhrases(tl, sing(m => m), 25))).toBe(100));
  it('stays perfect within the tolerance', () => expect(average(scorePhrases(tl, sing(m => m + 0.15), 25))).toBe(100));
  it('counts singing 40 cents sharp as wrong', () => expect(average(scorePhrases(tl, sing(m => m + 0.4), 25))).toBe(0));
  it('accepts singing an octave lower', () => expect(average(scorePhrases(tl, sing(m => m - 12), 25))).toBe(100));
  it('counts silence as missed', () => expect(average(scorePhrases(tl, sing(() => null), 25))).toBe(0));
  it('scores each phrase', () => expect(scorePhrases(tl, sing(m => m), 25)).toHaveLength(6));
  it('grades deviations', () => {
    expect(accuracy(10, 25)).toBe('good');
    expect(accuracy(-40, 25)).toBe('close');
    expect(accuracy(80, 25)).toBe('off');
  });
});

describe('placing pieces in the range', () => {
  for (const p of [...WARMUPS, ...MELODIES]) {
    it(`${p.title} fits the default range`, () => {
      const t = buildTimeline(p, tonicFor(p, DEFAULT_RANGE));
      const ms = t.targets.flatMap(x => [x.midi, x.to ?? x.midi]);
      expect(Math.min(...ms)).toBeGreaterThanOrEqual(DEFAULT_RANGE.low);
      expect(Math.max(...ms)).toBeLessThanOrEqual(DEFAULT_RANGE.high);
    });
  }
  it('guesses a voice type', () => {
    expect(voiceType({ low: 45, high: 64, measured: true })).toBe('Baryton');
    expect(voiceType({ low: 60, high: 84, measured: true })).toBe('Soprano');
  });
  it('repeats warm-ups a semitone higher', () => {
    const t = buildTimeline(pieceById('gamme5')!, 48);
    expect(t.phrases).toHaveLength(3);
    expect(t.targets.filter(x => x.phrase === 1)[0].midi).toBe(49);
  });
});
