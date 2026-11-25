import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import type { Tile } from '../lib/data';
import { lookOf, type Control, type Footswitch, type KnobStyle, type Motif } from '../lib/pedalLooks';
import { readStored } from '../lib/store';
import './PedalTile.css';

/** Small decorative knob on a pedal (angle in degrees). */
export function Knob({ deg, style = 'black', big }: { deg: number; style?: KnobStyle; big?: boolean }) {
  return <div className={`knob k-${style}${big ? ' big' : ''}`} style={{ transform: `rotate(${deg}deg)` }}><span /></div>;
}

/** What each tool does, drawn on its pedal (decorative). */
const MOTIFS: Record<Motif, ReactNode> = {
  needle: <><path d="M10 52 A40 40 0 0 1 90 52" /><path d="M50 52 L66 18" /><circle cx="50" cy="52" r="3" />{[18, 34, 50, 66, 82].map(x => <path key={x} d={`M${x} ${x === 50 ? 10 : 16} L${x} ${x === 50 ? 16 : 20}`} />)}</>,
  pendulum: <><path d="M30 56 L50 6 L70 56 Z" /><path d="M50 50 L62 16" /><circle cx="60" cy="22" r="4" /></>,
  lines: <>{[12, 22, 32, 42, 52].map(y => <path key={y} d={`M14 ${y} L88 ${y}`} />)}<path d="M22 6 L22 58" /></>,
  grid: <>{[0, 1, 2, 3].map(i => <rect key={i} x={8 + i * 22} y="12" width="18" height="18" rx="3" />)}{[0, 1, 2, 3].map(i => <rect key={'b' + i} x={8 + i * 22} y="34" width="18" height="18" rx="3" />)}</>,
  speaker: <><circle cx="50" cy="30" r="26" /><circle cx="50" cy="30" r="16" /><circle cx="50" cy="30" r="5" /></>,
  frets: <>{[10, 30, 50, 70, 90].map(x => <path key={x} d={`M${x} 8 L${x} 52`} />)}{[14, 22, 30, 38, 46].map(y => <path key={y} d={`M6 ${y} L94 ${y}`} className="thin" />)}<circle cx="40" cy="30" r="3" className="fill" /><circle cx="80" cy="22" r="3" className="fill" /><circle cx="80" cy="38" r="3" className="fill" /></>,
  progress: <>{[0, 1, 2, 3, 4].map(i => <rect key={i} x={6 + i * 18} y="24" width="14" height="12" rx="3" className={i < 3 ? 'fill' : ''} />)}</>,
  wave: <path d="M4 30 Q12 8 20 30 T36 30 T52 30 Q58 4 64 30 T76 30 Q82 18 88 30 T96 30" />,
  capo: <><path d="M10 22 L90 22" /><path d="M10 38 L90 38" className="thin" /><rect x="40" y="12" width="12" height="36" rx="4" /><path d="M52 18 Q72 18 74 30" /></>,
  list: <>{[12, 26, 40, 54].map((y, i) => <g key={y}><circle cx="12" cy={y} r="4" className="fill" /><path d={`M22 ${y} L${86 - i * 10} ${y}`} /></g>)}</>,
  dots: <>{[20, 40, 60, 80].map(x => <path key={x} d={`M${x} 6 L${x} 56`} className="thin" />)}{[18, 34, 50].map(y => <path key={y} d={`M14 ${y} L86 ${y}`} className="thin" />)}<circle cx="40" cy="26" r="5" className="fill" /><circle cx="60" cy="42" r="5" className="fill" /><circle cx="80" cy="42" r="5" className="fill" /></>,
  lyrics: <>{[14, 28, 42, 56].map((y, i) => <path key={y} d={`M10 ${y} L${70 + (i % 2) * 16} ${y}`} />)}<text x="10" y="9" className="txt">C</text><text x="52" y="23" className="txt">G</text></>,
  circle: <>{Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6; return <circle key={i} cx={50 + 24 * Math.sin(a)} cy={30 - 24 * Math.cos(a)} r="4" className={i === 0 ? 'fill' : ''} />; })}<circle cx="50" cy="30" r="10" /></>,
  ear: <><path d="M36 50 Q20 46 22 28 Q24 10 42 10 Q58 12 56 30 Q54 40 46 42 Q42 46 44 52" /><path d="M66 18 Q74 30 66 42" /><path d="M76 10 Q90 30 76 50" /></>,
  loop: <><path d="M24 30 A20 18 0 1 1 50 46" /><path d="M44 40 L50 46 L42 50" /><circle cx="76" cy="30" r="8" className="fill" /></>,
  target: <><circle cx="50" cy="30" r="24" /><circle cx="50" cy="30" r="14" /><circle cx="50" cy="30" r="4" className="fill" /><path d="M74 6 L56 24" /></>,
  slow: <><path d="M4 34 Q10 14 16 34 T28 34 T40 34 T52 34 T64 34 T76 34 T88 34 T96 34" /><path d="M30 8 L30 56" className="thick" /><path d="M70 8 L70 56" className="thick" /><path d="M30 10 L38 10 M70 10 L62 10" /></>,
  quiz: <><circle cx="30" cy="40" r="7" className="fill" /><path d="M37 40 L37 10 L52 16" /><circle cx="66" cy="44" r="7" className="fill" /><path d="M73 44 L73 14" /><path d="M84 18 Q84 8 92 8 Q99 8 98 16 Q97 22 91 25 L91 31" /><circle cx="91" cy="38" r="2" className="fill" /></>,
  gear: <><circle cx="50" cy="30" r="10" />{Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return <path key={i} d={`M${50 + 14 * Math.cos(a)} ${30 + 14 * Math.sin(a)} L${50 + 22 * Math.cos(a)} ${30 + 22 * Math.sin(a)}`} className="thick" />; })}</>,
};

function ControlView({ c }: { c: Control }) {
  switch (c.kind) {
    case 'knob': return <Knob deg={c.deg} style={c.style} big={c.big} />;
    case 'toggle': return <span className="ctl-toggle"><span /></span>;
    case 'slider': return <span className="ctl-slider"><span style={{ left: `${c.at * 100}%` }} /></span>;
    case 'lcd': return <span className="ctl-lcd mono">{c.live === 'bpm' ? readStored('metro.bpm', 92) : c.text}</span>;
    case 'jacks': return <span className="ctl-jacks"><span /><span /></span>;
  }
}
const FootswitchView = ({ kind }: { kind: Footswitch }) =>
  kind === 'twin' ? <div className="footswitch twin"><span /><span /></div> : <div className={'footswitch ' + kind} />;

export interface TileProps {
  t: Tile; wide?: boolean; edit?: boolean; lifted?: boolean;
  onOpen: () => void; onRemove?: () => void; onResize?: () => void;
  onGrip?: (e: PointerEvent<HTMLButtonElement>) => void; onGripKey?: (e: KeyboardEvent<HTMLButtonElement>) => void;
  /** Edit mode: opens the choice of compartment. */
  onSort?: () => void;
  /** Accessible name when the tap does something else than opening the tool (e.g. « Ajouter … »). */
  label?: string;
}

/** A tool drawn as its own effects pedal: LED, controls, drawing, name, footswitch (home board, Pratiquer, catalog). */
export function PedalTile({ t, wide = false, edit = false, lifted = false, onOpen, onRemove, onResize, onGrip, onGripKey, onSort, label }: TileProps) {
  const look = lookOf(t.id);
  return (
    <div
      role={edit ? undefined : 'button'}
      tabIndex={edit ? undefined : 0}
      aria-label={label}
      data-tile={t.id}
      className={`pedal finish-${look.finish}` + (wide ? ' wide' : '') + (edit ? ' editing' : '') + (lifted ? ' lifted' : '')}
      style={{ gridColumn: wide ? 'span 2' : 'span 1', background: t.bg, color: t.fg }}
      onClick={() => !edit && onOpen()}
      onKeyDown={e => { if (!edit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen(); } }}
    >
      <svg className={`pedal-motif m-${look.motif}`} viewBox="0 0 100 60" aria-hidden>{MOTIFS[look.motif]}</svg>
      <div className="pedal-top">
        <span className={'led pedal-led' + (t.on ? ' on' : '')} />
        {edit
          ? <button className="pedal-grip" data-grip={t.id} onPointerDown={onGrip} onKeyDown={onGripKey}
              aria-label={`Déplacer ${t.name} (flèches du clavier)`}>⠿</button>
          : <div className="pedal-knobs" aria-hidden>{look.controls.map((c, i) => <ControlView key={i} c={c} />)}</div>}
      </div>
      <div className="pedal-text">
        <span className="pedal-name">{t.name}</span>
        <span className="pedal-sub">{t.sub}</span>
        {t.on && <span className="sr-only">, utilisé aujourd’hui</span>}
      </div>
      {edit
        ? <div className="pedal-edit-btns">
            {onSort && <button className="pedal-size" onClick={onSort} aria-label={`Ranger ${t.name} dans un compartiment`}>▤ Ranger</button>}
            <button className="pedal-size" onClick={onResize} aria-label={wide ? `Réduire ${t.name}` : `Agrandir ${t.name}`}>{wide ? '↔ Petite' : '↔ Large'}</button>
          </div>
        : <FootswitchView kind={look.footswitch} />}
      {edit && <button className="pedal-remove" aria-label={`Retirer ${t.name}`} onClick={onRemove}>−</button>}
    </div>
  );
}
