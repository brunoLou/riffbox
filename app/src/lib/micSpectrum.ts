/**
 * The microphone as a spectrum, about ten times a second: for chord following and key detection.
 * Raw signal (no voice processing, which would cut a guitar's sustain).
 */
export interface SpectrumFrame { mags: Float32Array; sampleRate: number; fftSize: number; rms: number; ms: number }
export interface SpectrumListener { stop(): void }

export async function listenSpectrum(onFrame: (f: SpectrumFrame) => void): Promise<SpectrumListener> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ac = new Ctx();
  await ac.resume();
  const src = ac.createMediaStreamSource(stream);
  const an = ac.createAnalyser();
  an.fftSize = 8192;
  an.smoothingTimeConstant = 0.6;
  src.connect(an);
  const db = new Float32Array(an.frequencyBinCount);
  const mags = new Float32Array(an.frequencyBinCount);
  const time = new Float32Array(2048);

  const timer = window.setInterval(() => {
    an.getFloatTimeDomainData(time);
    let sum = 0;
    for (const v of time) sum += v * v;
    an.getFloatFrequencyData(db);
    for (let i = 0; i < db.length; i++) mags[i] = Number.isFinite(db[i]) ? 10 ** (db[i] / 20) : 0;
    onFrame({ mags, sampleRate: ac.sampleRate, fftSize: an.fftSize, rms: Math.sqrt(sum / time.length), ms: performance.now() });
  }, 100);

  return {
    stop() {
      clearInterval(timer);
      src.disconnect();
      stream.getTracks().forEach(t => t.stop());
      void ac.close();
    },
  };
}
