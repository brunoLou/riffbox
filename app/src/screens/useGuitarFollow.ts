import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { parseChordName, type ChordShape } from '../lib/chordDetect';
import { ChordFollower, followEvents, listenForChords, type ChordListener, type FollowEvent } from '../lib/chordFollow';
import type { SongLine } from '../lib/music';

export type FollowState = 'off' | 'starting' | 'on' | 'denied';

/**
 * « Suivre ma guitare » on the stage prompter: listens, follows the chords, and scrolls the line
 * being played to the upper third of the lyrics. Scrolling by hand (pedal, buttons, finger) moves
 * the follower to what is on screen.
 */
export function useGuitarFollow(lines: SongLine[], scrollRef: RefObject<HTMLDivElement>, enabled: boolean) {
  const events = useMemo(() => followEvents(lines), [lines]);
  const shapes = useMemo(() => {
    const out = new Map<string, ChordShape>();
    events.forEach(e => { const s = parseChordName(e.chord); if (s) out.set(e.chord, s); });
    return [...out.values()];
  }, [events]);
  const follower = useMemo(() => new ChordFollower(events), [events]);
  const [state, setState] = useState<FollowState>('off');
  const [heard, setHeard] = useState<string | null>(null);
  const [cur, setCur] = useState<FollowEvent | undefined>(undefined);
  const programmatic = useRef(0);

  /** Line element `i` of the lyrics. */
  const lineEl = (i: number) => scrollRef.current?.querySelector<HTMLElement>(`[data-line="${i}"]`) ?? null;

  const show = useCallback((e: FollowEvent | undefined) => {
    const el = scrollRef.current, line = e && lineEl(e.line);
    if (!el || !line) return;
    programmatic.current = performance.now();
    el.scrollTo({ top: Math.max(0, line.offsetTop - el.offsetTop - el.clientHeight * 0.28), behavior: 'smooth' });
  }, [scrollRef]);

  /** Follow from the first chord on screen. */
  const resyncToView = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !events.length) return;
    const top = el.scrollTop;
    const i = events.findIndex(e => { const l = lineEl(e.line); return !!l && l.offsetTop - el.offsetTop >= top - 4; });
    follower.resync(i < 0 ? events.length - 1 : i);
    setCur(follower.current);
  }, [events, follower, scrollRef]);

  /** Call from the lyrics' onScroll: a scroll the follower did not make is the player's. */
  const onScroll = useCallback(() => {
    if (!enabled || performance.now() - programmatic.current < 900) return;
    resyncToView();
  }, [enabled, resyncToView]);

  useEffect(() => {
    if (!enabled || !shapes.length) { setState('off'); setHeard(null); return; }
    let listener: ChordListener | null = null;
    let alive = true;
    setState('starting');
    resyncToView();
    listenForChords(shapes, (chord, ms) => {
      setHeard(h => (h === chord ? h : chord));
      if (follower.hear(chord, ms)) { setCur(follower.current); show(follower.current); }
    }).then(l => { if (alive) { listener = l; setState('on'); } else l.stop(); })
      .catch(() => { if (alive) setState('denied'); });
    return () => { alive = false; listener?.stop(); };
  }, [enabled, shapes, follower, show, resyncToView]);

  return { state, heard, current: enabled ? cur : undefined, next: enabled && cur ? follower.next : undefined, onScroll, hasChords: shapes.length > 0 };
}
