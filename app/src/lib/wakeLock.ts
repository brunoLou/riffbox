import { useEffect, useState } from 'react';

export type WakeState = 'on' | 'off' | 'unsupported';

/**
 * Keep the screen awake while the component is mounted (Screen Wake Lock API).
 * The browser drops the lock whenever the page is hidden, so it is taken again on return.
 */
export function useWakeLock(active = true): WakeState {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  const [state, setState] = useState<WakeState>(supported ? 'off' : 'unsupported');

  useEffect(() => {
    if (!active || !supported) return;
    let lock: WakeLockSentinel | null = null;
    let alive = true, pending = false;

    const acquire = async () => {
      if (pending || document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      pending = true;
      try {
        const l = await navigator.wakeLock.request('screen');
        if (!alive) { l.release().catch(() => {}); return; }
        lock = l;
        setState('on');
        l.addEventListener('release', () => { if (alive) setState('off'); });
      } catch {
        // Refused (battery saver, no user gesture yet…): stay off, retry on the next gesture or return.
        if (alive) setState('off');
      } finally {
        pending = false;
      }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') acquire(); };

    // Some browsers (Safari) only grant the lock after a user gesture: retry on taps and keys.
    const onGesture = () => { acquire(); };

    acquire();
    document.addEventListener('visibilitychange', onVisible);
    document.addEventListener('pointerdown', onGesture);
    document.addEventListener('keydown', onGesture);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
      document.removeEventListener('pointerdown', onGesture);
      document.removeEventListener('keydown', onGesture);
      lock?.release().catch(() => {});
    };
  }, [active, supported]);

  return state;
}
