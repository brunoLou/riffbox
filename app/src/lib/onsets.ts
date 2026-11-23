/**
 * Strums and plucks in a recording: the moments the sound suddenly gets louder (onsets), from the
 * energy in 5 ms slices. Pure logic; the coach's rhythm test compares them with the click.
 */
export function detectOnsets(samples: Float32Array, sampleRate: number, startTime = 0): number[] {
  const hop = Math.max(1, Math.round(sampleRate * 0.005));
  const env: number[] = [];
  for (let i = 0; i + hop <= samples.length; i += hop) {
    let e = 0;
    for (let k = i; k < i + hop; k++) e += samples[k] * samples[k];
    env.push(Math.sqrt(e / hop));
  }
  if (!env.length) return [];
  // Several strings beat against each other: smooth over 20 ms, and compare with the level a little
  // earlier (30 to 80 ms before) rather than with its lowest point.
  const sm = env.map((_, i) => { let t = 0, n = 0; for (let k = Math.max(0, i - 3); k <= i; k++) { t += env[k]; n++; } return t / n; });
  // A strummed guitar rings all the time: the floor is relative to the loudest moment, not to silence.
  const peak = Math.max(...sm);
  const thr = Math.max(peak * 0.08, 0.004);
  const out: number[] = [];
  let lastAt = -Infinity;
  for (let i = 16; i < sm.length; i++) {
    let ref = 0;
    for (let k = i - 16; k <= i - 6; k++) ref += sm[k];
    ref /= 11;
    // A rise: loud enough, clearly above the level just before, not right after another onset.
    if (sm[i] >= thr && sm[i] > ref * 1.35 + 0.002 && sm[i] > sm[i - 1] && i - lastAt > 30 /* 150 ms */) {
      out.push(startTime + (i * hop) / sampleRate);
      lastAt = i;
    }
  }
  return out;
}
