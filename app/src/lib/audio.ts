/** Microphone recording with live level, and a small synth for example phrases. */

let shared: AudioContext | null = null;
function ctx() {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!shared) shared = new Ctx();
  void shared.resume();
  return shared;
}

export interface Recording {
  /** Stops and returns the clip; `wave` has `bars` values in 0–1. */
  stop(bars?: number): Promise<{ url: string; blob: Blob; duration: number; wave: number[] }>;
  cancel(): void;
}

export async function startRecording(onLevel: (level: number) => void): Promise<Recording> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('unsupported');
  // Raw sound for music: no echo cancelling, noise suppression or automatic gain (they pump and dull a guitar).
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  const ac = ctx();
  const src = ac.createMediaStreamSource(stream);
  const an = ac.createAnalyser();
  an.fftSize = 1024;
  src.connect(an);
  const buf = new Float32Array(an.fftSize);
  const levels: number[] = [];
  const t0 = performance.now();
  let raf = 0, lastSample = 0;
  const loop = (now: number) => {
    an.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    const level = Math.min(1, Math.sqrt(sum / buf.length) * 4);
    onLevel(level);
    if (now - lastSample > 80) { levels.push(level); lastSample = now; }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  const rec = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.start();

  const cleanup = () => {
    cancelAnimationFrame(raf);
    src.disconnect();
    stream.getTracks().forEach(t => t.stop());
  };

  return {
    stop: (bars = 44) => new Promise(resolve => {
      rec.onstop = () => {
        cleanup();
        const duration = (performance.now() - t0) / 1000;
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        resolve({ url: URL.createObjectURL(blob), blob, duration, wave: downsample(levels, bars) });
      };
      rec.stop();
    }),
    cancel: () => { rec.onstop = null; if (rec.state !== 'inactive') rec.stop(); cleanup(); },
  };
}

function downsample(levels: number[], bars: number): number[] {
  if (!levels.length) return Array(bars).fill(0.12);
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    const a = Math.floor((i * levels.length) / bars), b = Math.max(a + 1, Math.floor(((i + 1) * levels.length) / bars));
    const slice = levels.slice(a, b);
    out.push(Math.max(...slice));
  }
  const peak = Math.max(...out, 0.05);
  return out.map(v => Math.max(0.12, v / peak));
}

export interface Playback { stop(): void }

/** Play a phrase of 8th notes with a plucked-string-ish synth. */
export function playLick(notes: number[], bpm: number, onEnd: () => void): Playback {
  const ac = ctx();
  const step = 30 / bpm;
  const t0 = ac.currentTime + 0.05;
  const master = ac.createGain();
  master.gain.value = 0.35;
  master.connect(ac.destination);
  notes.forEach((m, i) => {
    const t = t0 + i * step;
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 440 * 2 ** ((m - 69) / 12);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(2600, t);
    f.frequency.exponentialRampToValueAtTime(500, t + 0.3);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.8, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.25, step * 1.6));
    o.connect(f); f.connect(g); g.connect(master);
    o.start(t); o.stop(t + step * 1.8);
  });
  const timer = window.setTimeout(onEnd, (notes.length * step + 0.1) * 1000);
  return { stop: () => { clearTimeout(timer); master.disconnect(); } };
}

export function playUrl(url: string, onEnd: () => void): Playback {
  const a = new Audio(url);
  a.onended = onEnd;
  void a.play().catch(onEnd);
  return { stop: () => { a.onended = null; a.pause(); } };
}

/** Strum a chord: plucked notes from low to high, a few milliseconds apart. */
export function strum(notes: number[]): Playback {
  const ac = ctx();
  const t0 = ac.currentTime + 0.03;
  const master = ac.createGain();
  master.gain.value = 0.28;
  master.connect(ac.destination);
  notes.forEach((m, i) => {
    const t = t0 + i * 0.035;
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 440 * 2 ** ((m - 69) / 12);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(700, t + 0.6);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.7, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    o.connect(f); f.connect(g); g.connect(master);
    o.start(t); o.stop(t + 2.3);
  });
  return { stop: () => master.disconnect() };
}
