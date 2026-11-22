import type { KeyboardEvent, PointerEvent } from 'react';
import type { Tile } from '../lib/data';

/** Small decorative knob on a pedal (angle in degrees). */
export function Knob({ deg }: { deg: number }) {
  return <div className="knob" style={{ transform: `rotate(${deg}deg)` }}><span /></div>;
}

export interface TileProps {
  t: Tile; wide: boolean; edit: boolean; lifted: boolean;
  onOpen: () => void; onRemove: () => void; onResize: () => void;
  onGrip: (e: PointerEvent<HTMLButtonElement>) => void; onGripKey: (e: KeyboardEvent<HTMLButtonElement>) => void;
}

/** A tool on the home board, drawn as an effects pedal: LED, two knobs, name, footswitch. */
export function PedalTile({ t, wide, edit, lifted, onOpen, onRemove, onResize, onGrip, onGripKey }: TileProps) {
  return (
    <div
      role={edit ? undefined : 'button'}
      tabIndex={edit ? undefined : 0}
      data-tile={t.id}
      className={'pedal' + (edit ? ' editing' : '') + (lifted ? ' lifted' : '')}
      style={{ gridColumn: wide ? 'span 2' : 'span 1', background: t.bg, color: t.fg }}
      onClick={() => !edit && onOpen()}
      onKeyDown={e => { if (!edit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen(); } }}
    >
      <div className="pedal-top">
        <span className={'led pedal-led' + (t.on ? ' on' : '')} />
        {edit
          ? <button className="pedal-grip" data-grip={t.id} onPointerDown={onGrip} onKeyDown={onGripKey}
              aria-label={`Déplacer ${t.name} (flèches du clavier)`}>⠿</button>
          : <div className="pedal-knobs"><Knob deg={t.a} /><Knob deg={t.b} /></div>}
      </div>
      <div className="pedal-text">
        <span className="pedal-name">{t.name}</span>
        <span className="pedal-sub">{t.sub}</span>
        {t.on && <span className="sr-only">, utilisé aujourd’hui</span>}
      </div>
      {edit
        ? <button className="pedal-size" onClick={onResize} aria-label={wide ? `Réduire ${t.name}` : `Agrandir ${t.name}`}>{wide ? '↔ Petite' : '↔ Large'}</button>
        : <div className="footswitch" />}
      {edit && <button className="pedal-remove" aria-label={`Retirer ${t.name}`} onClick={onRemove}>−</button>}
    </div>
  );
}
