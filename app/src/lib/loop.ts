/**
 * Looper: pure logic (no audio API), so it can be tested on its own.
 * A loop is a whole number of bars at a tempo; each layer is exactly one loop long.
 */

export interface LoopSettings { bpm: number; beats: 3 | 4; bars: 1 | 2 | 4 | 8 }
export const LOOP_DEFAULTS: LoopSettings = { bpm: 90, beats: 4, bars: 2 };
export const LOOP_BPM = { min: 40, max: 220 };

export const loopSeconds = (s: LoopSettings) => (s.bars * s.beats * 60) / s.bpm;
export const loopFrames = (s: LoopSettings, sampleRate: number) => Math.round(loopSeconds(s) * sampleRate);

/** A piece of captured input: its first frame (on the audio clock) and its samples. */
export interface Chunk { frame: number; data: Float32Array }

/**
 * Collects the input between `start` and `start + length` (frames on the audio clock) from the
 * chunks as they come. `done` turns true once the whole span has arrived.
 */
export class Capture {
  readonly out: Float32Array;
  private filled = 0;
  constructor(readonly start: number, readonly length: number) { this.out = new Float32Array(length); }
  get done() { return this.filled >= this.length; }
  /** The frame up to which input has arrived (for progress). */
  reached = 0;
  add(c: Chunk) {
    const from = Math.max(c.frame, this.start), to = Math.min(c.frame + c.data.length, this.start + this.length);
    if (to > from) {
      this.out.set(c.data.subarray(from - c.frame, to - c.frame), from - this.start);
      this.filled += to - from;
    }
    this.reached = Math.max(this.reached, c.frame + c.data.length);
    // Chunks never overlap, but a gap (dropped audio) must not block the end: count it as silence.
    if (this.reached >= this.start + this.length) this.filled = this.length;
  }
}

/** The frame where a layer's recording starts: the loop start, later by the input/output latency. */
export const captureStart = (loopStartTime: number, latencySec: number, sampleRate: number) =>
  Math.round((loopStartTime + latencySec) * sampleRate);

/** The first loop start at or after `time` (loop starts are `t0 + k·length`). */
export function nextLoopStart(t0: number, length: number, time: number): number {
  const k = Math.max(0, Math.ceil((time - t0) / length - 1e-9));
  return t0 + k * length;
}
/** Where we are in the loop at `time`: 0 ≤ phase < length. */
export const loopPhase = (t0: number, length: number, time: number) => ((((time - t0) % length) + length) % length);

/** Layers mixed with their volumes; brought back under full scale if the sum clips. */
export function mix(layers: { data: Float32Array; gain: number }[], length: number): Float32Array {
  const out = new Float32Array(length);
  for (const l of layers) {
    if (!l.gain) continue;
    for (let i = 0; i < length && i < l.data.length; i++) out[i] += l.data[i] * l.gain;
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0.99) { const k = 0.99 / peak; for (let i = 0; i < length; i++) out[i] *= k; }
  return out;
}

/** `n` bar heights in 0–1 (peak per slice), for a waveform. */
export function peaks(data: Float32Array, n: number): number[] {
  const out: number[] = [];
  const step = data.length / n;
  let max = 0;
  for (let k = 0; k < n; k++) {
    let p = 0;
    for (let i = Math.floor(k * step); i < Math.floor((k + 1) * step); i++) p = Math.max(p, Math.abs(data[i]));
    out.push(p); max = Math.max(max, p);
  }
  return out.map(p => (max ? Math.round((p / max) * 100) / 100 : 0));
}

/**
 * Round-trip latency from test beeps: for each beep played at `beatFrames[i]`, the first sample of
 * the recording, within half a second, that rises well above the noise. Returns the median delay in
 * seconds, or null when the beeps were not heard clearly and consistently.
 */
export function measureLatency(rec: Float32Array, recStartFrame: number, beatFrames: number[], sampleRate: number): number | null {
  const win = Math.round(sampleRate * 0.5);
  const delays: number[] = [];
  for (const b of beatFrames) {
    const from = b - recStartFrame;
    if (from < 0 || from + win > rec.length) continue;
    // Noise: the 50 ms before the beep.
    let noise = 0;
    for (let i = Math.max(0, from - Math.round(sampleRate * 0.05)); i < from; i++) noise = Math.max(noise, Math.abs(rec[i]));
    let peak = 0;
    for (let i = from; i < from + win; i++) peak = Math.max(peak, Math.abs(rec[i]));
    if (peak < 0.02 || peak < noise * 4) continue;
    const thr = Math.max(noise * 3, peak * 0.35);
    for (let i = from; i < from + win; i++) if (Math.abs(rec[i]) >= thr) { delays.push((i - from) / sampleRate); break; }
  }
  if (delays.length < Math.ceil(beatFrames.length / 2)) return null;
  delays.sort((a, b) => a - b);
  const med = delays[delays.length >> 1];
  // Consistent: most beeps within 15 ms of the median.
  const close = delays.filter(d => Math.abs(d - med) <= 0.015).length;
  return close >= Math.ceil(delays.length * 0.6) ? med : null;
}
