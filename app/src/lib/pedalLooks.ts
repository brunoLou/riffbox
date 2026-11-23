/**
 * Each pedal of the home board has its own look, as on a real pedalboard: enclosure colour and
 * finish, controls, footswitch and a drawing of what the tool does. Every pedal is different.
 */

export type KnobStyle = 'black' | 'cream' | 'chrome' | 'chicken' | 'red';
export type Control =
  | { kind: 'knob'; style: KnobStyle; deg: number; big?: boolean }
  | { kind: 'toggle' }
  | { kind: 'slider'; at: number }
  /** A small display; `live` shows a value read when the board is drawn (the metronome's tempo…). */
  | { kind: 'lcd'; text: string; live?: 'bpm' }
  | { kind: 'jacks' };
export type Finish = 'solid' | 'brushed' | 'sparkle' | 'hammered' | 'stripe' | 'twotone';
export type Footswitch = 'round' | 'square' | 'twin' | 'button';
export type Motif =
  | 'needle' | 'pendulum' | 'lines' | 'grid' | 'speaker' | 'frets' | 'progress' | 'wave' | 'capo' | 'list'
  | 'dots' | 'lyrics' | 'circle' | 'ear' | 'loop' | 'target' | 'gear';

export interface PedalLook { finish: Finish; controls: Control[]; footswitch: Footswitch; motif: Motif }

const k = (style: KnobStyle, deg: number, big = false): Control => ({ kind: 'knob', style, deg, big });

export const LOOKS: Record<string, PedalLook> = {
  tuner: { finish: 'solid', controls: [{ kind: 'lcd', text: '440 Hz' }], footswitch: 'round', motif: 'needle' },
  metro: { finish: 'solid', controls: [{ kind: 'lcd', text: '92', live: 'bpm' }, k('black', 30, true)], footswitch: 'square', motif: 'pendulum' },
  carnet: { finish: 'twotone', controls: [{ kind: 'toggle' }, k('cream', -50), k('cream', 70)], footswitch: 'round', motif: 'lines' },
  grilles: { finish: 'brushed', controls: [k('chrome', -90), k('chrome', 10), k('chrome', 120)], footswitch: 'button', motif: 'grid' },
  backing: { finish: 'brushed', controls: [k('chicken', -70), k('chicken', 20), k('chicken', 80), k('chicken', -10), { kind: 'jacks' }], footswitch: 'twin', motif: 'speaker' },
  manche: { finish: 'solid', controls: [k('chicken', -40), k('chicken', 100)], footswitch: 'round', motif: 'frets' },
  routine: { finish: 'stripe', controls: [{ kind: 'slider', at: 0.65 }, k('black', -20)], footswitch: 'square', motif: 'progress' },
  voix: { finish: 'sparkle', controls: [k('cream', 60, true), { kind: 'toggle' }], footswitch: 'round', motif: 'wave' },
  capo: { finish: 'solid', controls: [k('red', -110), k('red', 30)], footswitch: 'button', motif: 'capo' },
  setlists: { finish: 'sparkle', controls: [{ kind: 'jacks' }, k('black', -60), k('black', 40), k('black', 110)], footswitch: 'square', motif: 'list' },
  accords: { finish: 'hammered', controls: [k('cream', 15), k('cream', -95)], footswitch: 'round', motif: 'dots' },
  morceaux: { finish: 'stripe', controls: [k('black', -30, true)], footswitch: 'button', motif: 'lyrics' },
  tonalite: { finish: 'sparkle', controls: [k('chrome', 50), k('chrome', -70)], footswitch: 'round', motif: 'circle' },
  detect: { finish: 'twotone', controls: [{ kind: 'toggle' }, k('black', 90)], footswitch: 'square', motif: 'ear' },
  looper: { finish: 'hammered', controls: [{ kind: 'lcd', text: 'LOOP' }, k('red', 0, true)], footswitch: 'twin', motif: 'loop' },
  coach: { finish: 'brushed', controls: [k('cream', -120), { kind: 'slider', at: 0.3 }], footswitch: 'round', motif: 'target' },
  reglages: { finish: 'hammered', controls: [k('black', 70), k('black', -40), { kind: 'toggle' }], footswitch: 'button', motif: 'gear' },
};
export const lookOf = (id: string): PedalLook => LOOKS[id] ?? { finish: 'solid', controls: [k('black', -40), k('black', 60)], footswitch: 'round', motif: 'lines' };
