import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { strum, type Playback } from '../lib/audio';
import { SHAPE_FR, capPos, chordType, voicingMidi, voicings } from '../lib/chords';
import { KEY_FR, chordName, chordTypeId, degreeOf, type Chord } from '../lib/music';
import { romanOf } from '../lib/suggest';
import { useStoredState, writeStored } from '../lib/store';
import { ChordDiagram } from './ChordDiagram';
import './GridChordSheet.css';
import { useDialog } from '../lib/useDialog';

/** Remembered position per chord name ("Bm" → 2), shared by every grid. */
export const VOICING_PREF_KEY = 'grid.voicings';

/** Root and type of a grid chord in the chord library's terms. */
export const chordOf = (c: Chord) => ({ root: c.pc, type: chordType(chordTypeId(c)) });

/**
 * Bottom sheet for one chord of a grid: its diagram, the other positions on the neck,
 * listen, step through the section's chords, open the library, or remove it.
 */
export function GridChordSheet({ chords, index, gridKey, section, onIndex, onRemove, onClose }: {
  chords: Chord[]; index: number; gridKey: number; section: string;
  onIndex: (i: number) => void; onRemove: (i: number) => void; onClose: () => void;
}) {
  const nav = useNavigate();
  const [prefs, setPrefs] = useStoredState<Record<string, number>>(VOICING_PREF_KEY, {});
  const player = useRef<Playback | null>(null);
  const dlg = useDialog(onClose);
  useEffect(() => () => player.current?.stop(), []);

  const c = chords[index];
  const name = chordName(c);
  const { root, type } = chordOf(c);
  const list = useMemo(() => voicings(root, type), [root, type]);
  const vi = Math.min(prefs[name] ?? 0, list.length - 1);
  const v = list[vi];
  const deg = c.x ? '' : degreeOf(gridKey, c.pc, c.m);

  const listen = () => { player.current?.stop(); player.current = strum(voicingMidi(v)); };
  const pick = (i: number) => {
    setPrefs({ ...prefs, [name]: i });
    player.current?.stop();
    player.current = strum(voicingMidi(list[i]));
  };
  const openLibrary = () => {
    // The library opens on this chord and this position (its own settings, as if chosen there).
    writeStored('chords.root', root);
    writeStored('chords.type', type.id);
    nav('/pratiquer/accords', { state: { pos: vi } });
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="set-sheet chord-sheet" ref={dlg} role="dialog" aria-label={`Accord ${name}`} onClick={e => e.stopPropagation()}>
        <div className="set-sheet-head">
          <span className="kicker sheet-kicker">{section} · accord {index + 1}/{chords.length}</span>
          <button className="player-close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <div className="cs-title-row">
          <button className="cs-step" onClick={() => onIndex(index - 1)} disabled={index === 0} aria-label="Accord précédent">‹</button>
          <div className="cs-title">
            <span className="cs-name">{name}</span>
            <span className="cs-sub">{KEY_FR[c.pc]} {type.fr}{deg ? ` · degré ${deg} en ${KEY_FR[gridKey]}` : c.x ? ` · ${romanOf(gridKey, c)} en ${KEY_FR[gridKey]}` : ' · hors du ton'}</span>
          </div>
          <button className="cs-step" onClick={() => onIndex(index + 1)} disabled={index === chords.length - 1} aria-label="Accord suivant">›</button>
        </div>

        <div className="cs-diagram" data-theme="dark">
          <ChordDiagram v={v} root={root} type={type} labels="notes" />
        </div>

        <div className="cs-pos-row">
          <button className="cs-step small" onClick={() => pick(vi - 1)} disabled={vi === 0} aria-label="Position précédente">‹</button>
          <span className="cs-pos">
            Forme de {SHAPE_FR[v.shape]} · {capPos(v) ? `case ${capPos(v)}` : 'position ouverte'} · {vi + 1}/{list.length}
          </span>
          <button className="cs-step small" onClick={() => pick(vi + 1)} disabled={vi === list.length - 1} aria-label="Position suivante">›</button>
        </div>

        <div className="cs-actions">
          <button className="btn-primary cs-listen" onClick={listen}>▶ Écouter</button>
          <button className="btn-outline cs-lib" onClick={openLibrary}>Bibliothèque ›</button>
        </div>
        <button className="cs-remove" onClick={() => onRemove(index)}>Retirer {name} de la grille</button>
      </div>
    </div>
  );
}
