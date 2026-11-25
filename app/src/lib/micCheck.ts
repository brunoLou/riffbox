/**
 * Microphone check: how loud the guitar arrives (too quiet, good, too loud, clipping), how quiet
 * the room is, and what the app hears (the note, the notes of a chord, the chord it guesses).
 */
import { chroma, parseChordName, rankChords, type ChordShape } from './chordDetect';
import { yin } from './pitch';

export type LevelKind = 'silence' | 'faible' | 'bon' | 'fort' | 'sature';
export interface Verdict { kind: LevelKind; label: string; tip: string }

/** Level in dB below full scale (0 dB: the loudest the microphone can take). */
export const toDb = (x: number) => (x > 0 ? Math.max(-90, 20 * Math.log10(x)) : -90);

/** Below this the app takes the sound for silence (the tuner's gate is about −42 dB). */
export const QUIET_DB = -40;
export const LOUD_DB = -10;
/** A sample this close to full scale is clipped: the sound is cut and the notes blur. */
export const CLIP = 0.98;

export function verdict(rmsDb: number, peak: number): Verdict {
  if (peak >= CLIP) return { kind: 'sature', label: 'Saturé', tip: 'Le son est écrêté : éloignez le micro, jouez moins fort ou baissez le volume de l’ampli ou de l’interface.' };
  if (rmsDb > LOUD_DB || peak > 0.9) return { kind: 'fort', label: 'Très fort', tip: 'À la limite : un peu plus fort et le son sature. Reculez un peu.' };
  if (rmsDb >= QUIET_DB) return { kind: 'bon', label: 'Bon niveau', tip: 'L’app vous entend bien.' };
  if (rmsDb >= -55) return { kind: 'faible', label: 'Trop faible', tip: 'L’app vous entend à peine : rapprochez le micro (30 cm de la rosace ou du haut-parleur) ou montez le volume.' };
  return { kind: 'silence', label: 'Rien n’arrive', tip: 'Jouez quelque chose. Si la barre ne bouge pas, vérifiez le micro choisi et l’autorisation du navigateur.' };
}

/** The room's own noise (dB), measured while the player keeps quiet. */
export const roomLabel = (db: number) => (db < -55 ? 'Pièce calme' : db < -45 ? 'Un peu de bruit de fond' : 'Pièce bruyante : le bruit gêne la reconnaissance');

/** The common chords the check can name: major, minor and seventh on the 12 roots. */
const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const COMMON: ChordShape[] = ROOTS.flatMap(r => ['', 'm', '7'].map(t => parseChordName(r + t)!));

/** The pitch classes clearly present (share of the chroma above `min`), loudest first. */
export const heard = (c: number[], min = 0.08) => c.map((v, pc) => ({ pc, v })).filter(x => x.v >= min).sort((a, b) => b.v - a.v).map(x => x.pc);

/** A chord when at least three notes sound and one common chord matches well; otherwise null. */
export function guessChord(ch: { c: number[]; bass: number | null }): string | null {
  if (heard(ch.c).length < 3) return null;
  const [best, second] = rankChords(ch, COMMON);
  return best.score >= 0.82 && best.score - second.score >= 0.02 ? best.name : null;
}

export interface MicFrame {
  rmsDb: number; peak: number; clipped: boolean;
  /** One note clearly heard (Hz), when the sound is a single note. */
  hz: number | null;
  /** Share of each pitch class (C = 0), and the chord guessed. */
  chroma: number[]; chord: string | null;
}
export interface MicCheck { stop(): void; label: string }

export async function audioInputs(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  return (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput');
}

export async function startMicCheck(deviceId: string | null, onFrame: (f: MicFrame) => void): Promise<MicCheck> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) },
  });
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ac = new Ctx();
  await ac.resume();
  const src = ac.createMediaStreamSource(stream);
  const an = ac.createAnalyser();
  an.fftSize = 8192;
  an.smoothingTimeConstant = 0.5;
  src.connect(an);
  const time = new Float32Array(an.fftSize);
  const db = new Float32Array(an.frequencyBinCount);
  const mags = new Float32Array(an.frequencyBinCount);
  // Samples per frame: the peak looks at the newest ones only (each sample counted once).
  const STEP = Math.round(ac.sampleRate * 0.08);

  const timer = window.setInterval(() => {
    an.getFloatTimeDomainData(time);
    const recent = time.subarray(time.length - Math.min(STEP, time.length));
    let peak = 0, sum = 0;
    for (const v of recent) { const a = Math.abs(v); if (a > peak) peak = a; sum += v * v; }
    const rms = Math.sqrt(sum / recent.length);
    an.getFloatFrequencyData(db);
    for (let i = 0; i < db.length; i++) mags[i] = Number.isFinite(db[i]) ? 10 ** (db[i] / 20) : 0;
    const loud = toDb(rms) >= -50;
    const ch = loud ? chroma(mags, ac.sampleRate, an.fftSize) : { c: new Array(12).fill(0), bass: null };
    const notes = heard(ch.c);
    onFrame({
      rmsDb: toDb(rms), peak, clipped: peak >= CLIP,
      hz: loud && notes.length <= 4 ? yin(time.subarray(time.length - 4096), ac.sampleRate) : null,
      chroma: ch.c, chord: loud ? guessChord(ch) : null,
    });
  }, 80);

  return {
    label: stream.getAudioTracks()[0]?.label ?? '',
    stop() {
      clearInterval(timer);
      src.disconnect();
      stream.getTracks().forEach(t => t.stop());
      void ac.close();
    },
  };
}
