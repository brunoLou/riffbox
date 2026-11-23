/** Files dropped on the window, waiting for the screen that takes them (song sheets, audio). */
import { useEffect, useRef } from 'react';
import { isAudioFile } from './myBacking';

export type DropKind = 'songs' | 'audio';
const SONG_EXT = /\.(pdf|cho|chopro|chordpro|crd|pro|txt)$/i;
export const dropKind = (f: File): DropKind | null => (isAudioFile(f) ? 'audio' : SONG_EXT.test(f.name) || f.type === 'application/pdf' ? 'songs' : null);

let pending: { kind: DropKind; files: File[] } | null = null;
const EVENT = 'riffbox-drop';

export function offerDrop(kind: DropKind, files: File[]) {
  pending = { kind, files };
  window.dispatchEvent(new Event(EVENT));
}
export const hasDropped = (kind: DropKind) => pending?.kind === kind;
export function takeDropped(kind: DropKind): File[] | null {
  if (pending?.kind !== kind) return null;
  const f = pending.files;
  pending = null;
  return f;
}

/** Calls `onFiles` with the files of `kind` dropped before this screen opened, or while it is open. */
export function useDropped(kind: DropKind, onFiles: (files: File[]) => void) {
  const cb = useRef(onFiles);
  cb.current = onFiles;
  useEffect(() => {
    const take = () => { const f = takeDropped(kind); if (f) cb.current(f); };
    take();
    window.addEventListener(EVENT, take);
    return () => window.removeEventListener(EVENT, take);
  }, [kind]);
}
/** Runs `onOffer` when files of `kind` are waiting (without taking them). */
export function useDropOffered(kind: DropKind, onOffer: () => void) {
  const cb = useRef(onOffer);
  cb.current = onOffer;
  useEffect(() => {
    const check = () => { if (hasDropped(kind)) cb.current(); };
    check();
    window.addEventListener(EVENT, check);
    return () => window.removeEventListener(EVENT, check);
  }, [kind]);
}
