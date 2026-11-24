import { useEffect, useRef, useState } from 'react';
import { playPiano, type Playback } from '../lib/audio';
import type { ChordType } from '../lib/chords';
import { NOTE_L, mod12 } from '../lib/music';
import { chordSpelling, nameChord } from '../lib/piano';
import { PianoKeys } from './PianoKeys';

/**
 * From the piano to the guitar: touch keys, hear them, read the chord they make, and open it in
 * the chord library to see it on the guitar.
 */
export function PianoFinder({ onPick }: { onPick: (root: number, type: ChordType) => void }) {
  const [sel, setSel] = useState<number[]>([]);
  const player = useRef<Playback | null>(null);
  useEffect(() => () => player.current?.stop(), []);
  const play = (notes: number[]) => { player.current?.stop(); player.current = playPiano(notes, 0.015); };
  const toggle = (m: number) => {
    const next = sel.includes(m) ? sel.filter(x => x !== m) : [...sel, m].sort((a, b) => a - b);
    if (!sel.includes(m)) play([m]);
    setSel(next);
  };
  const names = nameChord(sel).slice(0, 3);
  return (
    <div className="piano-chord piano-finder" data-theme="dark">
      <div className="piano-head">
        <span className="kicker">Touchez des notes</span>
        <button className="btn-link small" disabled={!sel.length} onClick={() => setSel([])}>Effacer</button>
        <button className="piano-play" disabled={!sel.length} aria-label="Écouter les notes choisies" onClick={() => play(sel)}>▶</button>
      </div>
      <PianoKeys from={48} to={71} lit={sel} rootPc={names[0]?.root ?? null} onKey={toggle} label="Clavier : touchez les notes de l’accord"
        names={names[0] ? chordSpelling(names[0].root, names[0].type) : undefined} />
      <div className="finder-result" role="status" aria-live="polite">
        {!sel.length ? <span className="piano-help">Choisissez au moins deux notes : l’app trouve l’accord et le montre à la guitare.</span>
          : !names.length ? <span className="piano-help">{sel.map(m => NOTE_L[mod12(m)]).join(' · ')} : pas un accord connu de la bibliothèque.</span>
          : names.map((n, i) => (
            <button key={n.name} className={'chip finder-chip' + (i === 0 ? ' on-amber' : '')} onClick={() => onPick(n.root, n.type)}
              aria-label={`Voir ${n.name} à la guitare`}>
              <b>{n.name}</b><span>{i === 0 ? 'voir à la guitare ›' : 'ou'}</span>
            </button>
          ))}
      </div>
    </div>
  );
}
