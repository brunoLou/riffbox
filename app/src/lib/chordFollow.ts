/**
 * « Suivre ma guitare »: where the player is in the song, from the chords heard.
 * Pure logic (testable without a browser) plus the microphone listener.
 */
import { chroma, rankChords, type ChordShape } from './chordDetect';
import type { SongLine } from './music';

/** One chord of the song where it is written: line index (in the parsed lines) and segment. */
export interface FollowEvent { line: number; seg: number; chord: string }

/** Every chord of the parsed song, in reading order (chord-less segments skipped). */
export function followEvents(lines: SongLine[]): FollowEvent[] {
  const out: FollowEvent[] = [];
  lines.forEach((l, line) => {
    if (l.kind !== 'line') return;
    l.segs.forEach((g, seg) => { const chord = g.chord.trim(); if (chord) out.push({ line, seg, chord }); });
  });
  return out;
}

export interface FollowOptions {
  /** How far ahead (in chords) a heard chord may move the position. */
  lookahead: number;
  /** How long a chord must be heard before it counts (ms). */
  holdMs: number;
}
export const FOLLOW_DEFAULTS: FollowOptions = { lookahead: 6, holdMs: 350 };

/**
 * Follows the player through the song's chords. It only moves forward, to the next place where
 * the heard chord is written (repeats of the current chord are passed over), within a few chords:
 * a stray or misheard chord cannot send it to the end of the song.
 */
export class ChordFollower {
  pos = 0;
  private cand: string | null = null;
  private since = 0;
  private committed: string | null = null;

  constructor(private events: FollowEvent[], private opts: FollowOptions = FOLLOW_DEFAULTS) {}

  get current(): FollowEvent | undefined { return this.events[this.pos]; }
  /** The next chord that is different from the current one (what the player should play next). */
  get next(): FollowEvent | undefined {
    const cur = this.current?.chord;
    return this.events.slice(this.pos + 1).find(e => e.chord !== cur);
  }

  /** A chord heard at `ms` (null: nothing clear). Returns true when the position moved. */
  hear(chord: string | null, ms: number): boolean {
    if (chord !== this.cand) { this.cand = chord; this.since = ms; return false; }
    if (chord === null || chord === this.committed || ms - this.since < this.opts.holdMs) return false;
    this.committed = chord;
    if (this.current?.chord === chord) return false;
    const end = Math.min(this.events.length, this.pos + 1 + this.opts.lookahead);
    for (let i = this.pos + 1; i < end; i++) {
      if (this.events[i].chord === chord) { this.pos = i; return true; }
    }
    return false;
  }

  /** The player moved by hand (pedal, buttons, scrolling): follow from this chord on. */
  resync(pos: number) {
    this.pos = Math.max(0, Math.min(this.events.length - 1, pos));
    this.committed = this.current?.chord ?? null;
    this.cand = null;
  }
}

/* ---------- Microphone ---------- */

export interface ChordListener { stop(): void }

/**
 * Listens to the guitar and reports, about ten times a second, the best of `candidates` when the
 * match is clear (else null). Raw signal: voice processing would cut the guitar's sustain.
 */
export async function listenForChords(candidates: ChordShape[], onChord: (chord: string | null, ms: number) => void): Promise<ChordListener> {
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
    if (Math.sqrt(sum / time.length) < 0.01) { onChord(null, performance.now()); return; }
    an.getFloatFrequencyData(db);
    for (let i = 0; i < db.length; i++) mags[i] = Number.isFinite(db[i]) ? 10 ** (db[i] / 20) : 0;
    const ranked = rankChords(chroma(mags, ac.sampleRate, an.fftSize), candidates);
    const [best, second] = ranked;
    const clear = best && best.score >= 0.72 && (!second || best.score - second.score >= 0.04);
    onChord(clear ? best.name : null, performance.now());
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
