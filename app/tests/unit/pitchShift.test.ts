import { describe, expect, it } from 'vitest';
import { newShiftState, shiftBlock } from '../../src/lib/pitchShift';

/** The pitch in successive short windows (zero crossings), to see what is heard over time. */
function pitches(x: Float32Array, sr: number) {
  const per: number[] = [];
  for (let a = 0; a + 800 <= x.length; a += 200) {
    const ups: number[] = [];
    for (let i = a + 1; i < a + 800; i++) if (x[i - 1] < 0 && x[i] >= 0) ups.push(i - x[i] / (x[i] - x[i - 1]));
    if (ups.length > 2) per.push((sr * (ups.length - 1)) / (ups[ups.length - 1] - ups[0]));
  }
  return per;
}
/** Share of the time the pitch heard is `want` (within a tenth of a semitone). */
const onPitch = (x: Float32Array, sr: number, want: number) => {
  const p = pitches(x, sr);
  return p.filter(f => Math.abs(f - want) / want < 0.006).length / p.length;
};
function run(semis: number) {
  const sr = 48000, n = sr; // one second of A 220 Hz
  const x = Float32Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 220 * i) / sr));
  const y = new Float32Array(n);
  const s = newShiftState();
  for (let k = 0; k < n; k += 128) shiftBlock(s, x.subarray(k, k + 128), y.subarray(k, k + 128), 2 ** (semis / 12));
  return { y: y.subarray(sr / 4), sr };
}

describe('transposing without changing speed', () => {
  it('0 semitones copies the sound through', () => {
    const { y, sr } = run(0);
    expect(onPitch(y, sr, 220)).toBe(1);
  });
  for (const semis of [-5, -2, 2, 7]) {
    it(`${semis > 0 ? '+' : ''}${semis} semitones moves the pitch, not the length`, () => {
      const { y, sr } = run(semis);
      const want = 220 * 2 ** (semis / 12);
      // Most of the time exactly the transposed note; the heads hand over only briefly.
      expect(onPitch(y, sr, want)).toBeGreaterThan(0.6);
      // Same number of samples out as in, and no silence: the level stays.
      const rms = Math.sqrt(y.reduce((t, v) => t + v * v, 0) / y.length);
      expect(rms).toBeGreaterThan(0.45);
    });
  }
});
