/**
 * Bluetooth page-turner pedals are keyboards: each pedal sends a key.
 * The keys are configurable (Réglages › Pédalier), and screens subscribe with `usePedal`.
 */
import { useEffect, useRef, useState } from 'react';
import { readStored, useStoredState } from './store';
import { modalOpen } from './useDialog';

/** Named after the pedal, not a meaning: each screen decides what a pedal does. */
export type PedalAction = 'right' | 'left' | 'middle';
export type PedalKeys = Record<PedalAction, string[]>;

export const PEDAL_KEY = 'pedal.keys';
export const PEDAL_ACTIONS: PedalAction[] = ['right', 'left', 'middle'];
export const PEDAL_NAMES: Record<PedalAction, string> = { right: 'Pédale droite', left: 'Pédale gauche', middle: 'Pédale du milieu' };
export const DEFAULT_PEDAL_KEYS: PedalKeys = {
  right: ['ArrowRight', 'ArrowDown', 'PageDown'],
  left: ['ArrowLeft', 'ArrowUp', 'PageUp'],
  middle: [' '],
};

/** What each pedal does, screen by screen (shown in Réglages). */
export const PEDAL_SCREENS: { screen: string; does: Partial<Record<PedalAction, string>> }[] = [
  { screen: 'Prompteur', does: { right: 'Page suivante, puis titre suivant', left: 'Page précédente, puis titre précédent', middle: 'Défilement auto' } },
  { screen: 'Métronome', does: { right: 'Lecture / arrêt', left: 'Tap tempo', middle: 'Lecture / arrêt' } },
  { screen: 'Grille', does: { right: 'Boucle lecture / arrêt', left: 'Section suivante', middle: 'Boucle lecture / arrêt' } },
  { screen: 'Backing tracks', does: { right: 'Lecture / pause', left: 'Reprendre à la mesure 1', middle: 'Lecture / pause' } },
  { screen: 'Routine', does: { right: 'Étape suivante', left: 'Go / pause', middle: 'Go / pause' } },
];

/** Keys that cannot be a pedal: modifiers alone, and keys the app needs for navigation. */
const IGNORED = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'Tab', 'Escape', 'Unidentified', 'Dead']);

/** Letters are stored lower-case so Shift does not matter. */
export const normKey = (k: string) => (k.length === 1 ? k.toLowerCase() : k);
export const canBePedal = (k: string) => !IGNORED.has(k);

const LABELS: Record<string, string> = {
  ArrowRight: '→', ArrowLeft: '←', ArrowUp: '↑', ArrowDown: '↓', PageDown: 'Page ↓', PageUp: 'Page ↑',
  ' ': 'Espace', Enter: 'Entrée', Backspace: 'Retour arr.', Home: 'Début', End: 'Fin',
  MediaPlayPause: 'Lecture/pause', MediaTrackNext: 'Piste suiv.', MediaTrackPrevious: 'Piste préc.',
  AudioVolumeUp: 'Volume +', AudioVolumeDown: 'Volume −',
};
export const keyLabel = (k: string) => LABELS[k] ?? (k.length === 1 ? k.toUpperCase() : k);

export const readPedalKeys = () => readStored<PedalKeys>(PEDAL_KEY, DEFAULT_PEDAL_KEYS);
export const usePedalKeys = () => useStoredState<PedalKeys>(PEDAL_KEY, DEFAULT_PEDAL_KEYS);

/** Assign `key` to `action`, taking it away from the other pedals. */
export function assignKey(keys: PedalKeys, action: PedalAction, key: string): PedalKeys {
  const k = normKey(key);
  const out = {} as PedalKeys;
  for (const a of PEDAL_ACTIONS) out[a] = keys[a].filter(x => x !== k);
  out[action] = [...out[action], k];
  return out;
}

export function actionFor(keys: PedalKeys, key: string): PedalAction | null {
  const k = normKey(key);
  return PEDAL_ACTIONS.find(a => keys[a].includes(k)) ?? null;
}

/** Typing in a field is not pedalling. */
function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/**
 * A web page cannot see which Bluetooth devices are connected, only the keys they send,
 * so the pedal counts as detected after its first press, for the rest of the visit.
 */
let seen = false;
export const pedalSeen = () => seen;
/** Tests only. */
export const resetPedalSeen = () => { seen = false; };

/**
 * Listen to the pedal on this screen. Only pedals with a handler are captured;
 * a held pedal (key repeat) counts once. Returns whether a pedal was seen and a blink flag.
 */
export function usePedal(handlers: Partial<Record<PedalAction, () => void>>) {
  const ref = useRef(handlers);
  ref.current = handlers;
  const [isSeen, setSeen] = useState(seen);
  const [flash, setFlash] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || modalOpen()) return;
      const a = actionFor(readPedalKeys(), e.key);
      const fn = a && ref.current[a];
      if (!fn) return;
      e.preventDefault();
      if (e.repeat) return;
      seen = true;
      setSeen(true);
      setFlash(f => f + 1);
      fn();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(0), 220);
    return () => clearTimeout(t);
  }, [flash]);

  return { seen: isSeen, flash: flash > 0 };
}
