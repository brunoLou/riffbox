/**
 * Playing a strumming pattern: the strokes as guitar chords (down: all strings, up: the treble
 * ones, softer), with a click, or with drums and bass (grids). Each sixteenth is a step whose
 * `beat` is its position in the bar, so the screen can follow stroke by stroke.
 */
import { parseChordName } from './chordDetect';
import type { Hit, Pattern, Step } from './metronome';
import { mod12 } from './music';
import type { Stroke } from './strum';

export interface PlayBar { slots: Stroke[]; chord?: string }
export interface PlayOptions {
  bpm: number; den: 4 | 8; swing?: boolean;
  /** Metronome click on the beats. */
  click?: boolean;
  /** Drums and bass under the chords (grids). */
  band?: boolean;
  /** Chord sounded when a bar names none (none: strokes are clicks only). */
  fallbackChord?: string;
  /** Sound the strokes (off: arrows and click only). */
  strum?: boolean;
}

/** A guitar-like voicing of a chord: the root low, then the chord tones above (MIDI). */
export function voicing(name: string | undefined): { notes: number[]; root: number } | null {
  const c = name ? parseChordName(name) : null;
  if (!c) return null;
  const root = 40 + mod12(c.bass - 4); // E2 to D#3
  const up = c.pcs.map(pc => 52 + mod12(pc - 4)).sort((a, b) => a - b);
  return { notes: [root, ...up, ...(up.length < 4 ? [up[0] + 12] : [])], root };
}

/** Whether a bar is played in sixteenths (it then ignores the swing). */
const hasSixteenths = (slots: Stroke[]) => slots.some((s, i) => s !== '-' && i % 2 === 1);

export function strumPattern(bars: PlayBar[], o: PlayOptions): Pattern {
  // A counted beat: a quarter (x/4) or a dotted quarter (6/8, 12/8).
  const pulseSlots = o.den === 8 ? 6 : 4;
  const swing = !!o.swing && o.den === 4 && !bars.some(b => hasSixteenths(b.slots));
  // Swung eighths sit on a triplet grid: 3 steps per beat instead of 4.
  const perBeat = swing ? 3 : pulseSlots;
  const stepDur = 60 / o.bpm / perBeat;
  const steps: Step[] = [];
  bars.forEach((bar, b) => {
    const v = voicing(bar.chord ?? o.fallbackChord);
    const beats = bar.slots.length / pulseSlots;
    // Each stroke lasts until the next one.
    const strokeAt: number[] = bar.slots.map((s, i) => (s === '-' ? -1 : i)).filter(i => i >= 0);
    for (let k = 0; k < beats * perBeat; k++) {
      const beat = Math.floor(k / perBeat), sub = k % perBeat;
      // The position (sixteenth) this step stands for; swing: the off-beat eighth is the 3rd triplet.
      const slot = swing ? (sub === 0 ? beat * 4 : sub === 2 ? beat * 4 + 2 : -1) : k;
      const hits: Hit[] = [];
      if (o.click) {
        if (sub === 0) hits.push(beat === 0 ? 'accent' : 'beat');
        else if (o.den === 8 && slot % 2 === 0) hits.push('sub');
      }
      if (o.band) {
        const half = Math.floor(beats / 2);
        if (sub === 0 && (beat === 0 || (beats >= 4 && beat === half))) hits.push('kick');
        if (sub === 0 && (o.den === 8 ? beat === 1 : beat % 2 === 1)) hits.push('snare');
        if (slot >= 0 && slot % 2 === 0) hits.push(sub === 0 ? 'hatAcc' : 'hat');
        if (v && sub === 0 && (beat === 0 || beat === half)) hits.push({ bass: v.root, dur: 60 / o.bpm * 0.9 });
      }
      const s = slot >= 0 ? bar.slots[slot] : '-';
      if (s !== '-' && o.strum !== false && v) {
        const next = strokeAt.find(i => i > slot) ?? bar.slots.length;
        const dur = Math.min(1.2, Math.max(0.08, (next - slot) * (60 / o.bpm / pulseSlots) * 0.92));
        hits.push(s === 'D' ? { chord: v.notes, dur, vol: 0.085 } : { chord: v.notes.slice(-3), dur, vol: 0.06 });
      } else if (s !== '-' && !o.click && !o.band) hits.push(s === 'D' ? 'beat' : 'sub');
      steps.push({ beat: slot >= 0 ? slot : null, bar: b, hits });
    }
  });
  return { steps, stepDur };
}
