/** Test audio: strummed guitar chords and their spectrum (no browser needed). */
export const SR = 48000, N = 8192;

/** Magnitude spectrum (Hann window), radix-2 FFT. */
export function spectrum(x: Float32Array): Float32Array {
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = x[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= N; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < N; i += len) for (let k = 0; k < len / 2; k++) {
      const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
      const ur = re[i + k], ui = im[i + k];
      const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi, vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
      re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
    }
  }
  const out = new Float32Array(N / 2);
  for (let i = 0; i < N / 2; i++) out[i] = Math.hypot(re[i], im[i]) / N;
  return out;
}

/** A strummed chord: strings low to high 15 ms apart, harmonics, slight detune, decay, noise. */
export function strum(midis: number[], seed = 1, at = 0.35): Float32Array {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const x = new Float32Array(N);
  const strings = midis.map((m, i) => ({ f: 440 * 2 ** ((m - 69) / 12 + (rnd() - 0.5) * 0.012), t0: i * 0.015, amp: 0.6 + rnd() * 0.5 }));
  for (let n = 0; n < N; n++) {
    const t = at + n / SR;
    let v = 0;
    for (const st of strings) {
      const dt = t - st.t0;
      if (dt < 0) continue;
      for (let k = 1; k <= 8; k++) v += (st.amp / k ** 1.3) * Math.exp(-dt * (1.2 + k * 0.4)) * Math.sin(2 * Math.PI * st.f * k * dt);
    }
    x[n] = v * 0.15 + (rnd() - 0.5) * 0.02;
  }
  return x;
}

