import { useEffect, useState } from 'react';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { ChordDiagram } from '../components/ChordDiagram';
import { voicings } from '../lib/chords';
import { useOffTimer } from '../lib/offGuitar';
import { useStoredState } from '../lib/store';
import {
  THEORY_KIND_FR, THEORY_LEVEL_FR, THEORY_STATS_KEY, levelKinds, makeTheoryQuestion, parseTChord, recordTheory, theorySummary,
  type TheoryKind, type TheoryLevel, type TheoryQuestion, type TheoryStats,
} from '../lib/theory';
import { markUsed } from '../lib/usage';
import './Oreille.css';
import './Theorie.css';

/** Pratiquer › Théorie: quick questions on chords and keys, to learn without a guitar. */
export default function Theorie() {
  const [level, setLevel] = useStoredState<TheoryLevel>('theory.level', 1);
  /** One kind of question only, or all of the level ('' ). */
  const [only, setOnly] = useStoredState<TheoryKind | ''>('theory.only', '');
  const [stats, setStats] = useStoredState<TheoryStats>(THEORY_STATS_KEY, {});
  const [q, setQ] = useState<TheoryQuestion | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [session, setSession] = useState({ ok: 0, n: 0 });
  const countTime = useOffTimer('theory');
  useEffect(() => markUsed('sansguitare'), []);
  const kinds = levelKinds(level);
  const kind = only && kinds.includes(only) ? only : undefined;

  const next = () => { setQ(makeTheoryQuestion(level, Math.random, kind, q?.diagram)); setPicked(null); };
  useEffect(() => { setQ(null); setPicked(null); setSession({ ok: 0, n: 0 }); }, [level, only]);

  const answer = (c: string) => {
    if (!q || picked) return;
    const ok = c === q.answer;
    setPicked(c);
    setStats(recordTheory(stats, q.kind, ok));
    setSession(s => ({ ok: s.ok + (ok ? 1 : 0), n: s.n + 1 }));
    countTime();
  };

  const sum = theorySummary(stats);
  const chord = q?.diagram ? parseTChord(q.diagram) : null;
  const v = chord ? voicings(chord.root.pc, chord.type)[0] : null;
  return (
    <Phone label="Théorie">
      <StatusBar />
      <div className="screen-body" style={{ gap: 14 }}>
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/pratiquer/sans-guitare" />
            <div className="head-titles">
              <span className="kicker">Sans guitare</span>
              <h1 className="display" style={{ fontSize: 30 }}>THÉORIE</h1>
            </div>
          </div>
          {session.n > 0 && <span className="sets-count mono" aria-label="Score de la séance">{session.ok}/{session.n}</span>}
        </div>

        <div className="seg" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }} role="group" aria-label="Niveau">
          {([1, 2, 3] as TheoryLevel[]).map(l => <button key={l} className={level === l ? 'on' : ''} aria-pressed={level === l} onClick={() => setLevel(l)}>{THEORY_LEVEL_FR[l]}</button>)}
        </div>
        <label className="theory-only">
          <span className="kicker">Questions</span>
          <select className="text-input" value={kind ?? ''} onChange={e => setOnly(e.target.value as TheoryKind | '')} aria-label="Type de questions">
            <option value="">Tout le niveau, au hasard</option>
            {kinds.map(k => <option key={k} value={k}>{THEORY_KIND_FR[k]}</option>)}
          </select>
        </label>

        {!q ? (
          <div className="ear-start">
            <p className="help">Des questions rapides sur les accords et les tonalités. Une bonne réponse ou une erreur, l’explication s’affiche : c’est en se trompant qu’on retient.</p>
            <button className="btn-primary" onClick={next}>Commencer</button>
          </div>
        ) : (
          <div className="ear-q">
            <span className="kicker theory-kind">{THEORY_KIND_FR[q.kind]}</span>
            <p className="theory-prompt">{q.prompt}</p>
            {v && chord && <div className="ear-shape" data-theme="dark"><ChordDiagram v={v} root={chord.root.pc} type={chord.type} labels="fingers" /></div>}
            {q.chords && <div className="theory-prog mono">{q.chords.join('  –  ')}</div>}
            <div className="ear-choices theory-choices" role="group" aria-label="Réponses">
              {q.choices.map(c => {
                const state = !picked ? '' : c === q.answer ? ' right' : c === picked ? ' wrong' : '';
                return <button key={c} className={'ear-choice' + state} disabled={!!picked} onClick={() => answer(c)}>{c}</button>;
              })}
            </div>
            {picked && (
              <p className={'ear-result' + (picked === q.answer ? ' ok' : ' ko')} role="status">
                {picked === q.answer ? 'Bonne réponse !' : `C’était : ${q.answer}.`}
              </p>
            )}
            {picked && <p className="theory-explain">{q.explain}</p>}
            {picked && <button className="btn-primary" onClick={next}>Suivant ›</button>}
          </div>
        )}

        {sum.n > 0 && (
          <p className="ear-stats" aria-label="Vos scores">
            Réussite <b>{sum.rate} %</b> sur {sum.n} question{sum.n > 1 ? 's' : ''}
            {sum.weakest && <> · à revoir : <b>{THEORY_KIND_FR[sum.weakest]}</b></>}
          </p>
        )}
      </div>
      <TabBar active={2} />
    </Phone>
  );
}
