import { useEffect, useRef, useState } from 'react';
import { strum, type Playback } from '../lib/audio';
import { chordType, voicingMidi, voicings } from '../lib/chords';
import { chordName, chordTypeId, type Chord } from '../lib/music';
import { FAMILY_FR, suggest, type SuggestFamily } from '../lib/suggest';
import './SuggestPanel.css';

const FAMILIES: SuggestFamily[] = ['natural', 'color', 'end'];
const notesOf = (c: Chord) => voicingMidi(voicings(c.pc, chordType(chordTypeId(c)))[0]);

/** Plays chords one after the other, two beats each. */
function playChords(chords: Chord[], bpm: number): Playback {
  const beat = 60 / bpm;
  let cur: Playback | null = null;
  const timers = chords.map((c, i) => window.setTimeout(() => { cur?.stop(); cur = strum(notesOf(c)); }, i * beat * 2 * 1000));
  return { stop: () => { timers.forEach(clearTimeout); cur?.stop(); } };
}

/**
 * « Idées pour la suite », under the grid: chords that can follow the last one of the section,
 * in three families. Each idea can be heard after the two chords before it, then added.
 */
export function SuggestPanel({ gridKey, chords, bpm, room, onAdd }: {
  gridKey: number; chords: Chord[]; bpm: number; room: number; onAdd: (chords: Chord[]) => void;
}) {
  const [fam, setFam] = useState<SuggestFamily>('natural');
  const [playing, setPlaying] = useState<number | null>(null);
  const player = useRef<Playback | null>(null);
  const timer = useRef(0);
  const stop = () => { player.current?.stop(); player.current = null; clearTimeout(timer.current); setPlaying(null); };
  useEffect(() => stop, []);

  const ideas = suggest(gridKey, chords)[fam];
  const last = chords[chords.length - 1];
  const context = chords.slice(-2);

  const listen = (i: number) => {
    if (playing === i) { stop(); return; }
    stop();
    const seq = [...context, ...ideas[i].chords];
    player.current = playChords(seq, bpm);
    setPlaying(i);
    timer.current = window.setTimeout(() => setPlaying(null), (seq.length * 2 + 1) * (60 / bpm) * 1000);
  };

  return (
    <section className="suggest" aria-label="Idées pour la suite">
      <div className="suggest-head">
        <span className="kicker suggest-kicker">{last ? `Après ${chordName(last)}` : 'Pour commencer'}</span>
        <div className="suggest-tabs" role="group" aria-label="Famille d’idées">
          {FAMILIES.map(f => (
            <button key={f} className={f === fam ? 'on' : ''} aria-pressed={f === fam} onClick={() => { stop(); setFam(f); }}>{FAMILY_FR[f]}</button>
          ))}
        </div>
      </div>
      {room <= 0 ? (
        <p className="suggest-full">Section pleine : retirez un accord pour en ajouter.</p>
      ) : (
        <div className="hscroll suggest-list">
          {ideas.map((s, i) => {
            const names = s.chords.map(chordName).join(' → ');
            return (
              <div key={fam + i} className={'sug' + (playing === i ? ' playing' : '')}>
                <button className="sug-add" onClick={() => { stop(); onAdd(s.chords); }} disabled={s.chords.length > room} aria-label={`Ajouter ${names} : ${s.why}`}>
                  <span className="sug-name">{names}</span>
                  <span className="sug-deg">{s.label}</span>
                  <span className="sug-why">{s.why}</span>
                </button>
                <button className="sug-play" onClick={() => listen(i)} aria-label={playing === i ? 'Arrêter l’écoute' : `Écouter ${context.length ? [...context.map(chordName), names].join(', ') : names}`}>
                  {playing === i ? '■' : '▶'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
