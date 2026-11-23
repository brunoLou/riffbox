import { useEffect, useRef, useState } from 'react';
import { getBlob, putBlob } from './blobs';
import { clampSpeed, fromFileName, isAudioFile, type MyTrack } from './myBacking';

/** Length of an audio file, or null when this browser cannot read it. */
export function probeDuration(blob: Blob): Promise<number | null> {
  return new Promise(resolve => {
    const a = new Audio();
    const url = URL.createObjectURL(blob);
    const done = (v: number | null) => { URL.revokeObjectURL(url); a.removeAttribute('src'); resolve(v); };
    const timer = setTimeout(() => done(null), 10_000);
    a.preload = 'metadata';
    a.onloadedmetadata = () => { clearTimeout(timer); done(Number.isFinite(a.duration) ? a.duration : 0); };
    a.onerror = () => { clearTimeout(timer); done(null); };
    a.src = url;
  });
}

/**
 * Keeps an audio file on the device as a backing track. Returns the track (to add to the list),
 * 'refused' when it is not audio this browser can read, or 'full' when there is no room left.
 */
export async function storeAudioFile(f: File, extra: Partial<MyTrack> = {}): Promise<MyTrack | 'refused' | 'full'> {
  if (!isAudioFile(f)) return 'refused';
  const duration = await probeDuration(f);
  if (duration === null) return 'refused';
  const id = 'bt' + Date.now() + Math.random().toString(36).slice(2, 6);
  if (!(await putBlob(id, f))) return 'full';
  return { id, ...fromFileName(f.name), created: Date.now(), size: f.size, type: f.type || 'audio/*', duration: Math.round(duration), loop: true, ...extra };
}

/**
 * One audio file played at a time: loop, speed with the pitch kept, position. `load` prepares a
 * track, `toggle` plays or pauses it.
 */
export function useFilePlayer(onError: (text: string) => void) {
  const [current, setCurrent] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);
  const loaded = useRef<string | null>(null);

  const release = () => {
    audio.current?.pause();
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null; audio.current = null; loaded.current = null;
    setPlaying(false); setCurrent(null); setTime(0);
  };
  useEffect(() => () => { audio.current?.pause(); if (url.current) URL.revokeObjectURL(url.current); }, []);

  const load = async (t: MyTrack): Promise<HTMLAudioElement | null> => {
    if (loaded.current === t.id && audio.current) return audio.current;
    release();
    const blob = await getBlob(t.id);
    if (!blob) { onError(`Le son de « ${t.name} » n’est pas sur cet appareil.`); return null; }
    const a = new Audio();
    url.current = URL.createObjectURL(blob);
    a.src = url.current;
    a.loop = t.loop ?? true;
    a.playbackRate = t.speed ?? 1;
    const p = a as HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean };
    p.preservesPitch = true; p.webkitPreservesPitch = true;
    a.ontimeupdate = () => setTime(a.currentTime);
    a.onended = () => { setPlaying(false); setTime(0); };
    audio.current = a; loaded.current = t.id;
    setCurrent(t.id); setTime(0);
    return a;
  };

  const pause = () => { audio.current?.pause(); setPlaying(false); };
  /** Plays `t` (loading it if needed), or pauses it if it is playing. Returns true when it plays. */
  const toggle = async (t: MyTrack, beforePlay?: () => void): Promise<boolean> => {
    if (loaded.current === t.id && playing) { pause(); return false; }
    const a = await load(t);
    if (!a) return false;
    beforePlay?.();
    try { await a.play(); setPlaying(true); return true; }
    catch { onError('Lecture impossible : ce format n’est pas lu par ce navigateur.'); return false; }
  };
  const restart = () => { if (audio.current) { audio.current.currentTime = 0; setTime(0); } };
  const seek = (v: number) => { if (audio.current) { audio.current.currentTime = v; setTime(v); } };
  const setSpeed = (v: number) => { const s = clampSpeed(v); if (audio.current) audio.current.playbackRate = s; return s; };
  const setLoop = (on: boolean) => { if (audio.current) audio.current.loop = on; };

  return { current, playing, time, load, toggle, pause, restart, seek, setSpeed, setLoop, release };
}
