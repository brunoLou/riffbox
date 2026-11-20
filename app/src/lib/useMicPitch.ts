import { useEffect, useRef, useState } from 'react';
import { startPitch, type PitchTracker } from './pitch';

export type MicState = 'starting' | 'on' | 'denied' | 'unsupported';

/**
 * Live microphone pitch while the screen is open and visible.
 * The callback always sees the latest props; `retry` asks for the microphone again.
 */
export function useMicPitch(onPitch: (hz: number | null, level: number, time: number) => void, enabled = true) {
  const [state, setState] = useState<MicState>('starting');
  const [attempt, setAttempt] = useState(0);
  const cb = useRef(onPitch);
  cb.current = onPitch;

  useEffect(() => {
    if (!enabled) return;
    let tracker: PitchTracker | null = null;
    let cancelled = false;
    const start = async () => {
      setState('starting');
      try {
        const t = await startPitch((hz, lv, time) => cb.current(hz, lv, time));
        if (cancelled) { t.stop(); return; }
        tracker = t;
        setState('on');
      } catch (e) {
        if (!cancelled) setState((e as Error).message === 'unsupported' ? 'unsupported' : 'denied');
      }
    };
    const onVis = () => {
      if (document.hidden) { tracker?.stop(); tracker = null; }
      else if (!tracker) void start();
    };
    void start();
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelled = true; tracker?.stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [attempt, enabled]);

  return { state, retry: () => setAttempt(a => a + 1) };
}
