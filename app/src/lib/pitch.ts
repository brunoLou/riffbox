/** Microphone pitch tracking for the tuner (YIN algorithm). */

const MIN_HZ = 60;     // below drop C on a guitar
const MAX_HZ = 1100;   // above the 12th fret of the high e
const WINDOW = 2048;
const THRESHOLD = 0.12;

/** Fundamental frequency of `buf` in Hz, or null if no clear pitch. */
export function yin(buf: Float32Array, sr: number): number | null {
  const maxLag = Math.min(Math.floor(sr / MIN_HZ), buf.length - WINDOW);
  const minLag = Math.floor(sr / MAX_HZ);
  const d = new Float32Array(maxLag + 1);
  for (let tau = 1; tau <= maxLag; tau++) {
    let sum = 0;
    for (let i = 0; i < WINDOW; i++) { const x = buf[i] - buf[i + tau]; sum += x * x; }
    d[tau] = sum;
  }
  // Cumulative mean normalized difference.
  let running = 0;
  d[0] = 1;
  for (let tau = 1; tau <= maxLag; tau++) { running += d[tau]; d[tau] = running ? (d[tau] * tau) / running : 1; }

  let tau = -1;
  for (let t = minLag; t <= maxLag; t++) {
    if (d[t] < THRESHOLD) {
      while (t + 1 <= maxLag && d[t + 1] < d[t]) t++;
      tau = t; break;
    }
  }
  if (tau < 0) {
    // No dip under the threshold: accept the global minimum only if it is reasonably clear.
    let best = minLag;
    for (let t = minLag; t <= maxLag; t++) if (d[t] < d[best]) best = t;
    if (d[best] > 0.3) return null;
    tau = best;
  }
  // Parabolic interpolation around the dip for sub-sample precision.
  const a = d[tau - 1] ?? d[tau], b = d[tau], c = d[tau + 1] ?? d[tau];
  const den = a + c - 2 * b;
  const shift = den ? (a - c) / (2 * den) : 0;
  return sr / (tau + shift);
}

export interface PitchTracker { stop(): void; sampleRate: number }

/**
 * Open the microphone and report the detected pitch (Hz, or null when silent/unclear)
 * about 20 times per second.
 */
export async function startPitch(onPitch: (hz: number | null, level: number) => void): Promise<PitchTracker> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
  // Raw signal: voice processing would distort a guitar's pitch and level.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ac = new Ctx();
  await ac.resume();
  const src = ac.createMediaStreamSource(stream);
  const an = ac.createAnalyser();
  an.fftSize = 4096;
  src.connect(an);
  const buf = new Float32Array(an.fftSize);

  const timer = window.setInterval(() => {
    an.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    const rms = Math.sqrt(sum / buf.length);
    onPitch(rms < 0.008 ? null : yin(buf, ac.sampleRate), rms);
  }, 50);

  return {
    sampleRate: ac.sampleRate,
    stop() {
      clearInterval(timer);
      src.disconnect();
      stream.getTracks().forEach(t => t.stop());
      void ac.close();
    },
  };
}

/** Frequency → fractional MIDI note number. */
export const hzToMidi = (hz: number) => 69 + 12 * Math.log2(hz / 440);
