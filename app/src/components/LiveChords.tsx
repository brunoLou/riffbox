import { voicings } from '../lib/chords';
import { chordName, type Chord } from '../lib/music';
import { useStoredState } from '../lib/store';
import { ChordDiagram } from './ChordDiagram';
import { PIANO_SHOW_KEY, PianoChord, PianoToggle } from './PianoChord';
import { VOICING_PREF_KEY, chordOf } from './GridChordSheet';
import './LiveChords.css';

/** A chord's diagram in the position chosen for it in its sheet (the first one otherwise). */
function Diagram({ c, prefs, size }: { c: Chord; prefs: Record<string, number>; size: 'big' | 'small' }) {
  const { root, type } = chordOf(c);
  const list = voicings(root, type);
  const v = list[Math.min(prefs[chordName(c)] ?? 0, list.length - 1)];
  return v ? <ChordDiagram v={v} root={root} type={type} labels="fingers" size={size} /> : null;
}

/** The chord being played, on the piano (compact keyboard). */
function NowPiano({ c, prefs }: { c: Chord; prefs: Record<string, number> }) {
  const { root, type } = chordOf(c);
  const list = voicings(root, type);
  return <PianoChord root={root} type={type} voicing={list[Math.min(prefs[chordName(c)] ?? 0, list.length - 1)]} compact />;
}

/**
 * While the grid loops: the diagram of the chord being played, changing with the bars, and the
 * next one (smaller) to get the hand ready.
 */
export function LiveChords({ chords, bar }: { chords: Chord[]; bar: number }) {
  const [prefs] = useStoredState<Record<string, number>>(VOICING_PREF_KEY, {});
  const [piano, setPiano] = useStoredState(PIANO_SHOW_KEY, true);
  if (!chords.length) return null;
  const i = ((bar % chords.length) + chords.length) % chords.length;
  const now = chords[i], next = chords[(i + 1) % chords.length];
  return (
    <div className="live-chords" data-theme="dark" role="status" aria-live="polite" aria-label={`Accord joué : ${chordName(now)}, ensuite ${chordName(next)}`}>
      <div className="live-now">
        <span className="live-kicker">Joué · mesure {i + 1}/{chords.length}</span>
        <span className="live-name">{chordName(now)}</span>
        <div className="live-diagram big" key={'n' + i}><Diagram c={now} prefs={prefs} size="big" /></div>
      </div>
      <div className="live-next">
        <span className="live-kicker">Ensuite</span>
        <span className="live-name small">{chordName(next)}</span>
        <div className="live-diagram"><Diagram c={next} prefs={prefs} size="big" /></div>
      </div>
      <div className="live-piano">
        <PianoToggle show={piano} onChange={setPiano} />
        {piano && <NowPiano c={now} prefs={prefs} />}
      </div>
    </div>
  );
}
