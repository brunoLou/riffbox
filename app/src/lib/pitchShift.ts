/**
 * Transposing a recording without changing its speed (to work out a song in another key, or at
 * the guitar's pitch): two reading heads move through a short delay line at `ratio` times the
 * normal speed, each faded in and out so that one is always heard while the other jumps back.
 */

export interface ShiftState { buf: Float32Array; w: number; phase: number }
export const WINDOW = 3072;
export const newShiftState = (): ShiftState => ({ buf: new Float32Array(WINDOW * 2), w: 0, phase: 0 });

/** One block of samples through the shifter (`ratio` 2^(semitones/12); 1 copies through). Pure, no browser. */
export function shiftBlock(s: ShiftState, input: Float32Array, output: Float32Array, ratio: number) {
  const N = s.buf.length, win = 3072;
  const read = (d: number) => {
    let p = s.w - d;
    while (p < 0) p += N;
    const i = Math.floor(p), f = p - i;
    return s.buf[i % N] * (1 - f) + s.buf[(i + 1) % N] * f;
  };
  for (let k = 0; k < input.length; k++) {
    s.buf[s.w] = input[k];
    if (ratio === 1) { output[k] = input[k]; s.w = (s.w + 1) % N; continue; }
    // The delay grows by (1 − ratio) a sample: the heads read `ratio` samples per sample.
    s.phase += (1 - ratio) / win;
    s.phase -= Math.floor(s.phase);
    const p2 = (s.phase + 0.5) % 1;
    // Each head plays alone most of the time; they hand over in a short crossfade (a fifth of the
    // cycle), the weights always adding up to 1. A long crossfade would blur the pitch.
    const u = Math.abs(s.phase - 0.5);
    const w1 = Math.min(1, Math.max(0, (0.35 - u) / 0.2));
    output[k] = read(s.phase * win + 1) * w1 + read(p2 * win + 1) * (1 - w1);
    s.w = (s.w + 1) % N;
  }
}

/** The shifter as an AudioWorklet (code built from `shiftBlock`, so the browser runs the tested logic). */
const WORKLET = `
const shiftBlock = (${shiftBlock.toString()});
class Shift extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [{ name: 'ratio', defaultValue: 1, minValue: 0.25, maxValue: 4 }]; }
  constructor() { super(); this.st = []; }
  process(inputs, outputs, params) {
    const input = inputs[0], output = outputs[0];
    for (let c = 0; c < output.length; c++) {
      this.st[c] ??= { buf: new Float32Array(${WINDOW * 2}), w: 0, phase: 0 };
      shiftBlock(this.st[c], input[c] ?? new Float32Array(output[c].length), output[c], params.ratio[0]);
    }
    return true;
  }
}
registerProcessor('riffbox-shift', Shift);
`;

const loaded = new WeakMap<BaseAudioContext, Promise<void>>();
/** A node that transposes what goes through it by `semitones` (changed with `.set`). */
export async function createShifter(ctx: AudioContext) {
  if (!loaded.has(ctx)) {
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
    loaded.set(ctx, ctx.audioWorklet.addModule(url));
  }
  await loaded.get(ctx);
  const node = new AudioWorkletNode(ctx, 'riffbox-shift', { outputChannelCount: [2] });
  return {
    node,
    set: (semitones: number) => node.parameters.get('ratio')!.setValueAtTime(2 ** (semitones / 12), ctx.currentTime),
  };
}
