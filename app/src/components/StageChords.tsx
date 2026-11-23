import { voicings } from '../lib/chords';
import { parseChordName } from '../lib/chordDetect';
import { useStoredState } from '../lib/store';
import { ChordDiagram } from './ChordDiagram';
import { VOICING_PREF_KEY } from './GridChordSheet';
import './StageChords.css';

/** One chord written in a song (« A7 », « C#m », « D/F# »): its name and its diagram. */
function Shape({ name, prefs, now }: { name: string; prefs: Record<string, number>; now?: boolean }) {
  const s = parseChordName(name);
  const list = s ? voicings(s.root, s.type) : [];
  const v = list[Math.min(prefs[name] ?? 0, Math.max(0, list.length - 1))];
  return (
    <div className={'sc-chord' + (now ? ' now' : ' next')}>
      <span className="sc-kicker">{now ? 'Maintenant' : 'Ensuite'}</span>
      <span className="sc-name">{name}</span>
      <div className="sc-diagram" key={name}>
        {v && s ? <ChordDiagram v={v} root={s.root} type={s.type} labels="fingers" size="big" /> : <span className="sc-none">—</span>}
      </div>
    </div>
  );
}

/**
 * Under the stage lyrics: the diagram of the chord to play now and of the next one, so the hand
 * is ready before the change.
 */
export function StageChords({ now, next }: { now?: string; next?: string }) {
  const [prefs] = useStoredState<Record<string, number>>(VOICING_PREF_KEY, {});
  if (!now) return null;
  return (
    <div className="stage-chords" role="status" aria-live="polite"
      aria-label={`Accord : ${now}${next ? `, ensuite ${next}` : ''}`}>
      <Shape name={now} prefs={prefs} now />
      {next && <span className="sc-arrow" aria-hidden>›</span>}
      {next && <Shape name={next} prefs={prefs} />}
    </div>
  );
}
