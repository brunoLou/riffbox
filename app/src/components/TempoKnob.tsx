import { useEffect, useRef } from 'react';
import './TempoKnob.css';

const SWEEP = 270;

/** Big rotary knob: drag up/down, scroll, or use the arrow keys. */
export function TempoKnob({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; v: number } | null>(null);
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };

  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v)));
  const frac = (value - min) / (max - min);

  // Native, non-passive wheel listener so the page doesn't scroll.
  useEffect(() => {
    const el = ref.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { value: v, onChange: cb } = latest.current;
      cb(Math.max(min, Math.min(max, v + (e.deltaY < 0 ? 1 : -1))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [min, max]);

  return (
    <div
      ref={ref}
      className="tknob"
      role="slider"
      tabIndex={0}
      aria-label="Tempo"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value} BPM`}
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { y: e.clientY, v: value }; }}
      onPointerMove={e => { if (drag.current) onChange(clamp(drag.current.v + (drag.current.y - e.clientY) / 3)); }}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
      onKeyDown={e => {
        const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 }[e.key];
        if (d) { e.preventDefault(); onChange(clamp(value + d)); }
      }}
    >
      <div className="tknob-ring" style={{ background: `conic-gradient(from 225deg, var(--amber) 0deg ${frac * SWEEP}deg, #3a3530 ${frac * SWEEP}deg ${SWEEP}deg, transparent ${SWEEP}deg)` }} />
      <div className="tknob-cap">
        <div className="tknob-pointer" style={{ transform: `rotate(${-135 + frac * SWEEP}deg)` }}><span /></div>
        <span className="tknob-val">{value}</span>
        <span className="tknob-unit">BPM</span>
      </div>
      <span className="tknob-lim" style={{ left: 18 }}>{min}</span>
      <span className="tknob-lim" style={{ right: 12 }}>{max}</span>
    </div>
  );
}
