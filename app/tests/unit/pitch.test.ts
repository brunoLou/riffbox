import { describe, expect, it } from 'vitest';
import { hzToMidi, yin } from '../../src/lib/pitch';

const SR = 48000;
/** A plucked-string-like tone: fundamental plus decaying harmonics. */
function tone(hz: number, n = 4096) {
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) for (let k = 1; k <= 5; k++) buf[i] += (0.6 / k) * Math.sin((2 * Math.PI * hz * k * i) / SR);
  return buf;
}
const cents = (a: number, b: number) => 1200 * Math.log2(a / b);

describe('pitch detection (YIN)', () => {
  for (const hz of [73.42, 82.41, 110, 146.83, 196, 246.94, 329.63, 440, 659.25]) {
    it(`finds ${hz} Hz within 3 cents`, () => {
      const found = yin(tone(hz), SR);
      expect(found).not.toBeNull();
      expect(Math.abs(cents(found!, hz))).toBeLessThan(3);
    });
  }
  it('reads a detuned string', () => {
    const hz = 110 * 2 ** (10 / 1200);
    expect(Math.round(cents(yin(tone(hz), SR)!, 110))).toBe(10);
  });
  it('returns nothing on silence', () => {
    expect(yin(new Float32Array(4096), SR)).toBeNull();
  });
  it('converts Hz to MIDI', () => {
    expect(hzToMidi(440)).toBeCloseTo(69, 6);
    expect(hzToMidi(82.4069)).toBeCloseTo(40, 3);
  });
});
