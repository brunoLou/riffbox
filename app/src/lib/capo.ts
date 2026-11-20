import { KEY_FR, mod12 } from './music';

/** Keys whose chords are easy open shapes on guitar. */
const OPEN_MAJOR = [0, 7, 2, 9, 4];   // C G D A E
const OPEN_MINOR = [9, 4, 2];         // Am Em Dm

export interface CapoOption { capo: number; shapes: number; open: boolean; label: string }

/** Every way to sound `key` with a capo from 0 to 9: play shapes of `shapes`, capo on fret `capo`. */
export function capoOptions(key: number, minor = false): CapoOption[] {
  const open = minor ? OPEN_MINOR : OPEN_MAJOR;
  return Array.from({ length: 10 }, (_, capo) => {
    const shapes = mod12(key - capo);
    return { capo, shapes, open: open.includes(shapes), label: KEY_FR[shapes] + (minor ? ' m' : '') };
  });
}

/** Best option: open shapes with the lowest capo (no capo if the key is already open). */
export const bestCapo = (key: number, minor = false) => capoOptions(key, minor).find(o => o.open) ?? capoOptions(key, minor)[0];

/** Shift in semitones, from -5 to +6. */
export const signedShift = (n: number) => { const m = mod12(n); return m > 6 ? m - 12 : m; };
