import { ACC_COLOR, accuracy, foldTo, isNatural, noteFr, type Target, type TracePoint } from '../lib/voice';
import './PitchRoll.css';

const W = 354, GUTTER = 38;

interface Props {
  /** Visible pitch range (MIDI). */
  lo: number; hi: number;
  height: number;
  /** Seconds shown across the plot; with `now`, the view scrolls and `now` sits at 30 %. */
  window: number;
  /** Current time (scrolling view) — omit for a fixed view starting at 0. */
  now?: number;
  /** Playhead for a fixed view (recording review). */
  playhead?: number;
  targets?: Target[];
  trace: TracePoint[];
  tol: number;
  /** Reference pitch for colouring: the target at that time, else the nearest semitone. */
  targetAt?: (t: number) => number | null;
}

/** Scrolling staff: semitone rows, target notes as bars, the voice as a line coloured by accuracy. */
export function PitchRoll({ lo, hi, height, window: win, now, playhead, targets = [], trace, tol, targetAt }: Props) {
  const left = now === undefined ? 0 : now - win * 0.3;
  const plotW = W - GUTTER;
  const x = (t: number) => GUTTER + ((t - left) / win) * plotW;
  const row = height / (hi - lo + 1);
  const y = (m: number) => (hi - m + 0.5) * row;
  const visible = (t0: number, t1: number) => t1 >= left && t0 <= left + win;

  // Voice line: segments between consecutive points, coloured by deviation; the trace is drawn in
  // the octave of its reference so a voice an octave away still shows on the staff.
  const segs: { x1: number; y1: number; x2: number; y2: number; c: string }[] = [];
  let last: { x: number; y: number; t: number; m: number } | null = null;
  let lastDot: { x: number; y: number; c: string } | null = null;
  for (const p of trace) {
    if (p.m === null || !visible(p.t, p.t)) { last = null; continue; }
    const ref = targetAt?.(p.t) ?? Math.round(p.m);
    const m = foldTo(p.m, ref);
    const c = ACC_COLOR[accuracy((m - (targetAt?.(p.t) ?? Math.round(m))) * 100, tol)];
    const px = x(p.t), py = y(m);
    // Break the line on gaps and on jumps (new note, or the octave fold switching sides).
    if (last && p.t - last.t < 0.16 && Math.abs(m - last.m) < 2) segs.push({ x1: last.x, y1: last.y, x2: px, y2: py, c });
    last = { x: px, y: py, t: p.t, m };
    lastDot = { x: px, y: py, c };
  }

  const rows = [];
  for (let m = lo; m <= hi; m++) rows.push(m);
  const active = now !== undefined ? targets.find(t => now >= t.t0 && now < t.t0 + t.dur) : undefined;

  return (
    <svg className="roll" viewBox={`0 0 ${W} ${height}`} width="100%" height={height} role="img" aria-label="Courbe de la voix et notes à chanter">
      {rows.map(m => (
        <g key={m}>
          <rect x={GUTTER} y={y(m) - row / 2} width={plotW} height={row} className={isNatural(m) ? 'roll-row' : 'roll-row sharp'} />
          {isNatural(m) && <text x={GUTTER - 6} y={y(m) + 3.5} className={'roll-label' + (m % 12 === 0 ? ' c' : '')} textAnchor="end">{noteFr(m)}</text>}
        </g>
      ))}
      {targets.filter(t => visible(t.t0, t.t0 + t.dur)).map((t, i) => {
        const on = t === active;
        if (t.to !== undefined) {
          return <line key={i} x1={x(t.t0)} y1={y(t.midi)} x2={x(t.t0 + t.dur)} y2={y(t.to)} className={'roll-glide' + (on ? ' on' : '')} strokeWidth={Math.max(6, row * 0.7)} />;
        }
        return (
          <g key={i}>
            <rect x={x(t.t0) + 1} y={y(t.midi) - row * 0.38} width={Math.max(4, x(t.t0 + t.dur) - x(t.t0) - 2)} height={row * 0.76} rx={4} className={'roll-note' + (on ? ' on' : '')} />
            {t.syl && <text x={x(t.t0) + 4} y={y(t.midi) + row * 0.38 + 12} className="roll-syl">{t.syl}</text>}
          </g>
        );
      })}
      {segs.map((s, i) => <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.c} className="roll-voice" />)}
      {now !== undefined && <line x1={x(now)} x2={x(now)} y1={0} y2={height} className="roll-now" />}
      {now !== undefined && lastDot && <circle cx={lastDot.x} cy={lastDot.y} r={5.5} fill={lastDot.c} className="roll-dot" />}
      {playhead !== undefined && <line x1={x(playhead)} x2={x(playhead)} y1={0} y2={height} className="roll-now play" />}
    </svg>
  );
}
