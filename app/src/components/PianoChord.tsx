import { useEffect, useRef } from 'react';
import { playPiano, type Playback } from '../lib/audio';
import { chordSymbol, type ChordType, type Voicing } from '../lib/chords';
import { mod12 } from '../lib/music';
import { chordSpelling, guitarNotes, keyRange, pianoVoicing } from '../lib/piano';
import { useStoredState } from '../lib/store';
import { PianoKeys } from './PianoKeys';

export type PianoView = 'piano' | 'guitar';
export const PIANO_VIEW_KEY = 'piano.view';

/** The chord's notes on the keyboard: as a pianist plays it, or exactly the guitar position's. */
export function chordKeys(root: number, type: ChordType, view: PianoView, v?: Voicing | null) {
  return view === 'guitar' && v ? guitarNotes(v) : pianoVoicing(root, type);
}

/**
 * The same chord on the piano, under its guitar diagram: how a pianist plays it, or the guitar
 * position's own notes laid on the keyboard. `compact`: just the keyboard (grids, stage).
 */
export function PianoChord({ root, type, voicing, compact }: { root: number; type: ChordType; voicing?: Voicing | null; compact?: boolean }) {
  const [view, setView] = useStoredState<PianoView>(PIANO_VIEW_KEY, 'piano');
  const notes = chordKeys(root, type, view, voicing);
  const [from, to] = keyRange(notes);
  const player = useRef<Playback | null>(null);
  useEffect(() => () => player.current?.stop(), []);
  const sym = chordSymbol(root, type);
  const keys = <PianoKeys from={from} to={to} lit={notes} rootPc={mod12(root)} compact={compact} names={chordSpelling(root, type)}
    label={`${sym} au piano : ${view === 'guitar' && voicing ? 'les notes de la position guitare' : 'position de pianiste'}`} />;
  if (compact) return <div className="piano-chord compact" data-theme="dark">{keys}</div>;
  return (
    <div className="piano-chord" data-theme="dark">
      <div className="piano-head">
        <span className="kicker">Au piano</span>
        <div className="mini-seg" role="group" aria-label="Notes au piano">
          <button className={view === 'piano' ? 'on' : ''} aria-pressed={view === 'piano'} onClick={() => setView('piano')}>Pianiste</button>
          <button className={view === 'guitar' ? 'on' : ''} aria-pressed={view === 'guitar'} disabled={!voicing} onClick={() => setView('guitar')}>Notes de la guitare</button>
        </div>
        <button className="piano-play" aria-label={`Écouter ${sym} au piano`}
          onClick={() => { player.current?.stop(); player.current = playPiano(notes, 0.02); }}>▶</button>
      </div>
      {keys}
      <p className="piano-help">{view === 'guitar' && voicing
        ? 'Les notes exactes de la position guitare : la guitare étale l’accord sur plusieurs octaves.'
        : 'La fondamentale à la main gauche, l’accord serré à la main droite.'}</p>
    </div>
  );
}

export const PIANO_SHOW_KEY = 'piano.show';
/** Shows or hides the keyboard next to the live diagrams (grids, stage). */
export function PianoToggle({ show, onChange }: { show: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className={'piano-toggle' + (show ? ' on' : '')} aria-pressed={show} onClick={() => onChange(!show)}
      title={show ? 'Masquer le clavier' : 'Voir l’accord au piano'}>Piano</button>
  );
}
