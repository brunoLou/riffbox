/**
 * « Suivre ma guitare »: where the player is in the song, from the chords heard.
 * Pure logic (testable without a browser) plus the microphone listener.
 */
import { chroma, rankChords, type ChordShape } from './chordDetect';
import { listenSpectrum } from './micSpectrum';
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

/** Reports, about ten times a second, the best of `candidates` when the match is clear (else null). */
export async function listenForChords(candidates: ChordShape[], onChord: (chord: string | null, ms: number) => void): Promise<ChordListener> {
  return listenSpectrum(({ mags, sampleRate, fftSize, rms, ms }) => {
    if (rms < 0.01) { onChord(null, ms); return; }
    const [best, second] = rankChords(chroma(mags, sampleRate, fftSize), candidates);
    const clear = best && best.score >= 0.72 && (!second || best.score - second.score >= 0.04);
    onChord(clear ? best.name : null, ms);
  });
}
