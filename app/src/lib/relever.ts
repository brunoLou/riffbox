/** Working out a song by ear: pure helpers for the « Relever » screen (no browser). */

/** Loudness overview of a recording: the peak of each of `n` slices (0–1). */
export function peaks(data: Float32Array, n: number): number[] {
  const out: number[] = [];
  const size = Math.max(1, Math.floor(data.length / n));
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (let j = i * size, end = Math.min(data.length, j + size); j < end; j++) { const v = Math.abs(data[j]); if (v > m) m = v; }
    out.push(m);
  }
  const top = Math.max(...out, 1e-6);
  return out.map(v => v / top);
}

/** A loop from A to B (seconds): where to go when the playhead passes B, else null. */
export function loopJump(t: number, a: number | null, b: number | null): number | null {
  return a !== null && b !== null && b - a >= 0.2 && t >= b ? a : null;
}

/** Setting A or B: B always after A (they swap if set the other way round). */
export function setMark(which: 'a' | 'b', t: number, a: number | null, b: number | null): { a: number | null; b: number | null } {
  const next = which === 'a' ? { a: t, b } : { a, b: t };
  if (next.a !== null && next.b !== null && next.b < next.a) return { a: next.b, b: next.a };
  return next;
}

export const SPEEDS = [0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1];
export const clampSpeed = (v: number) => Math.round(Math.max(0.25, Math.min(1.5, v)) * 100) / 100;
export const clampSemis = (v: number) => Math.max(-12, Math.min(12, Math.round(v)));
export const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
