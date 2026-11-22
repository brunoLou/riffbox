import { describe, expect, it } from 'vitest';
import { Capture, captureStart, loopFrames, loopPhase, loopSeconds, measureLatency, mix, nextLoopStart, peaks } from '../../src/lib/loop';

describe('loop length and clock', () => {
  it('a whole number of bars at the tempo, to the sample', () => {
    expect(loopSeconds({ bpm: 120, beats: 4, bars: 2 })).toBe(4);
    expect(loopFrames({ bpm: 90, beats: 3, bars: 4 }, 48000)).toBe(384000); // 12 beats × 0.666… s
    expect(loopFrames({ bpm: 97, beats: 4, bars: 1 }, 44100)).toBe(Math.round((240 / 97) * 44100));
  });
  it('next loop start and phase', () => {
    expect(nextLoopStart(10, 4, 9)).toBe(10);
    expect(nextLoopStart(10, 4, 10)).toBe(10);
    expect(nextLoopStart(10, 4, 10.01)).toBe(14);
    expect(nextLoopStart(10, 4, 21.5)).toBe(22);
    expect(loopPhase(10, 4, 15)).toBeCloseTo(1);
    expect(loopPhase(10, 4, 9)).toBeCloseTo(3);
  });
  it('the recording starts later by the latency', () => {
    expect(captureStart(2, 0.1, 48000)).toBe(100800);
  });
});

describe('capturing one loop from the input chunks', () => {
  const chunks = (from: number, n: number, size = 128) =>
    Array.from({ length: n }, (_, k) => ({ frame: from + k * size, data: Float32Array.from({ length: size }, (_, i) => from + k * size + i) }));
  it('exactly the span asked, whatever the chunk boundaries', () => {
    const c = new Capture(1000, 500);
    for (const ch of chunks(900, 3)) c.add(ch); // up to 1284
    expect(c.done).toBe(false);
    for (const ch of chunks(1284, 2)) c.add(ch); // up to 1540
    expect(c.done).toBe(true);
    expect(c.out[0]).toBe(1000);
    expect(c.out[499]).toBe(1499);
    expect(c.out.every((v, i) => v === 1000 + i)).toBe(true);
  });
  it('a gap in the input is silence and does not block the end', () => {
    const c = new Capture(0, 300);
    c.add({ frame: 0, data: new Float32Array(100).fill(1) });
    c.add({ frame: 200, data: new Float32Array(150).fill(1) });
    expect(c.done).toBe(true);
    expect(c.out[150]).toBe(0);
    expect(c.out[250]).toBe(1);
  });
});

describe('mixing and waveform', () => {
  it('sums with the volumes, muted layers out, brought under full scale when it clips', () => {
    const a = new Float32Array([0.5, 0.5, -0.5]), b = new Float32Array([0.25, 1, -1]);
    expect([...mix([{ data: a, gain: 1 }, { data: b, gain: 0 }], 3)]).toEqual([0.5, 0.5, -0.5]);
    const m = mix([{ data: a, gain: 1 }, { data: b, gain: 1 }], 3);
    expect(Math.max(...m.map(Math.abs))).toBeCloseTo(0.99);
    expect(m[0] / m[1]).toBeCloseTo(0.75 / 1.5);
  });
  it('peaks per slice, scaled to the loudest', () => {
    expect(peaks(new Float32Array([0, 0.5, 0, -1]), 2)).toEqual([0.5, 1]);
  });
});

describe('measuring the latency from beeps', () => {
  const sr = 48000;
  const beeps = (delay: number, noise = 0.002, jitter = 0) => {
    const rec = new Float32Array(sr * 5);
    for (let i = 0; i < rec.length; i++) rec[i] = (Math.sin(i * 12.9898) * 43758.5453 % 1) * noise;
    const times = Array.from({ length: 8 }, (_, k) => Math.round((0.2 + k * 0.6) * sr));
    times.forEach((t, k) => {
      const at = t + Math.round((delay + (k % 2 ? jitter : -jitter)) * sr);
      for (let i = 0; i < 1500; i++) rec[at + i] += Math.sin((2 * Math.PI * 1760 * i) / sr) * Math.exp(-i / 400) * 0.4;
    });
    return { rec, times };
  };
  it('finds the delay within a millisecond', () => {
    for (const d of [0.02, 0.085, 0.19, 0.31]) {
      const { rec, times } = beeps(d);
      expect(measureLatency(rec, 0, times, sr)).toBeCloseTo(d, 2);
    }
  });
  it('a little jitter is fine; beeps not heard or inconsistent give nothing', () => {
    expect(measureLatency(beeps(0.1, 0.002, 0.004).rec, 0, beeps(0.1).times, sr)).toBeCloseTo(0.1, 1);
    const silent = new Float32Array(sr * 5);
    expect(measureLatency(silent, 0, beeps(0.1).times, sr)).toBeNull();
    const { rec, times } = beeps(0.1, 0.002, 0.08);
    expect(measureLatency(rec, 0, times, sr)).toBeNull();
  });
});
