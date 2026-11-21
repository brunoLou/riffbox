import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * Fret width for a neck drawing: `min` on a phone (the neck scrolls), wider when the container
 * has room, so that on a tablet the whole neck shows without scrolling.
 */
export function useFretWidth(ref: RefObject<HTMLElement>, open: number, frets: number, min: number) {
  const [w, setW] = useState(min);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // A tablet may go a little narrower than a phone so the neck fits without scrolling.
    const fit = () => {
      const floor = el.clientWidth >= 600 ? Math.min(min, 40) : min;
      setW(Math.max(floor, Math.floor((el.clientWidth - open) / frets)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, open, frets, min]);
  return w;
}
