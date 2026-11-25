/**
 * MIDI footswitches as pedals (Chrome on Android and computers: Web MIDI). Each footswitch sends a
 * note, a control change or a program change; the player teaches the app which one is which pedal
 * (Réglages › Pédalier), and screens receive the same three pedals as with a Bluetooth pedal.
 */
import type { PedalAction } from './pedal';
import { readStored, writeStored } from './store';

export interface MidiMsg { kind: 'note' | 'cc' | 'pc'; ch: number; num: number; value: number }
/** A footswitch, as « cc:1:64 » (kind, channel 1–16, number). */
export type MidiMap = Partial<Record<PedalAction, string>>;
export const MIDI_MAP_KEY = 'pedal.midi';
export const MIDI_ON_KEY = 'pedal.midiOn';

/** A raw MIDI message → what it is (null for anything else: clock, sysex, aftertouch…). */
export function parseMidi(data: ArrayLike<number>): MidiMsg | null {
  const st = data[0];
  if (st === undefined) return null;
  const type = st & 0xf0, ch = (st & 0x0f) + 1;
  if (type === 0x90 || type === 0x80) return { kind: 'note', ch, num: data[1] ?? 0, value: type === 0x80 ? 0 : data[2] ?? 0 };
  if (type === 0xb0) return { kind: 'cc', ch, num: data[1] ?? 0, value: data[2] ?? 0 };
  if (type === 0xc0) return { kind: 'pc', ch, num: data[1] ?? 0, value: 127 };
  return null;
}
export const midiSig = (m: MidiMsg) => `${m.kind}:${m.ch}:${m.num}`;
/** A press, not a release (note off, or a control going back to 0). */
export const isPress = (m: MidiMsg) => m.value >= 64 || (m.kind === 'note' && m.value > 0);
export function midiLabel(sig: string) {
  const [k, ch, n] = sig.split(':');
  return `${k === 'note' ? 'Note' : k === 'cc' ? 'CC' : 'Programme'} ${n} · canal ${ch}`;
}
/** Assign a footswitch to a pedal, taking it away from the others. */
export function assignMidi(map: MidiMap, action: PedalAction, sig: string): MidiMap {
  const out: MidiMap = {};
  for (const [a, s] of Object.entries(map) as [PedalAction, string][]) if (s !== sig) out[a] = s;
  out[action] = sig;
  return out;
}
export const actionForMidi = (map: MidiMap, m: MidiMsg): PedalAction | null =>
  (Object.entries(map) as [PedalAction, string][]).find(([, s]) => s === midiSig(m))?.[0] ?? null;

/* ---------- Connection (browser) ---------- */

type Listener = (m: MidiMsg) => void;
const listeners = new Set<Listener>();
/** Every MIDI message from any connected input (learning listens here too). */
export function onMidi(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; }

let access: Promise<{ inputs: string[] }> | null = null;
export const midiSupported = () => typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;

/** Connect to the MIDI inputs (asks the browser's permission the first time). Names of the inputs found. */
export function connectMidi(): Promise<{ inputs: string[] }> {
  if (!midiSupported()) return Promise.reject(new Error('Ce navigateur ne gère pas le MIDI (essayez Chrome).'));
  access ??= (navigator as Navigator & { requestMIDIAccess: () => Promise<MIDIAccess> }).requestMIDIAccess().then(a => {
    const bind = () => a.inputs.forEach(inp => {
      inp.onmidimessage = e => { const m = e.data && parseMidi(e.data); if (m) listeners.forEach(fn => fn(m)); };
    });
    bind();
    a.onstatechange = bind; // a pedal plugged in later
    writeStored(MIDI_ON_KEY, true);
    return { get inputs() { return [...a.inputs.values()].map(i => i.name ?? 'Entrée MIDI'); } };
  }).catch(err => { access = null; throw err; });
  return access;
}
/** At start-up: reconnect if the player had connected a MIDI pedal on this device. */
export function restoreMidi() { if (readStored(MIDI_ON_KEY, false) && midiSupported()) connectMidi().catch(() => undefined); }
export const forgetMidi = () => { writeStored(MIDI_ON_KEY, false); writeStored(MIDI_MAP_KEY, {}); };
