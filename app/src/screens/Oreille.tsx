import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { ChordDiagram } from '../components/ChordDiagram';
import { playPiano, playSteps, strum, type Playback } from '../lib/audio';
import { parseChordName } from '../lib/chordDetect';
import { listenForChords, type ChordListener } from '../lib/chordFollow';
import { voicings } from '../lib/chords';
import {
  EAR_LEVEL_FR, EAR_STATS_KEY, INTERVALS, QUALITY_FR, chordFr, heardTarget, makeQuestion, playable, progressionDef, recordAnswer, summary,
  type EarLevel, type EarMode, type EarStats, type Question,
} from '../lib/ear';
import { useStoredState } from '../lib/store';
import { markUsed } from '../lib/usage';
import { useOffTimer } from '../lib/offGuitar';
import './Oreille.css';

const MODES: { id: EarMode; label: string }[] = [
  { id: 'intervals', label: 'Intervalles' }, { id: 'chords', label: 'Accords' },
  { id: 'progressions', label: 'Suites d’accords' }, { id: 'play', label: 'Jouer l’accord' },
];
const answerLabel = (mode: EarMode, id: string) =>
  mode === 'intervals' ? INTERVALS.find(i => String(i.semis) === id)?.name ?? id : mode === 'chords' ? QUALITY_FR[id] ?? id
    : mode === 'progressions' ? progressionDef(id)?.label ?? id : chordFr(id);
const isMode = (x: string | null): x is EarMode => MODES.some(m => m.id === x);

/** Oreille : name what the app plays (intervals, chords), or play the chord it names. */
export default function Oreille() {
  const [params] = useSearchParams();
  const [mode, setMode] = useStoredState<EarMode>('ear.mode', 'intervals');
  // Opened from the session without a guitar: that exercise.
  useEffect(() => { const m = params.get('mode'); if (isMode(m)) setMode(m); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [levels, setLevels] = useStoredState<Record<EarMode, EarLevel>>('ear.level', { intervals: 1, chords: 1, progressions: 1, play: 1 });
  const [together, setTogether] = useStoredState('ear.harmonic', false);
  const [stats, setStats] = useStoredState<EarStats>(EAR_STATS_KEY, {});
  const level = levels[mode] ?? 1;
  const [q, setQ] = useState<Question | null>(null);
  const [result, setResult] = useState<{ ok: boolean; picked?: string } | null>(null);
  const [session, setSession] = useState({ ok: 0, n: 0 });
  const player = useRef<Playback | null>(null);
  // Answering counts as practice without a guitar (not « Jouer l’accord », played on the guitar).
  const countTime = useOffTimer(mode === 'play' ? null : mode === 'progressions' ? 'progressions' : 'ear');
  useEffect(() => markUsed('oreille'), []);
  useEffect(() => () => player.current?.stop(), []);

  const play = (x: Question | null = q) => {
    if (!x || x.mode === 'play') return;
    player.current?.stop();
    player.current = x.mode === 'intervals' ? playPiano(x.notes, together ? 0 : 0.7)
      : x.mode === 'progressions' && x.seq ? playSteps(x.seq, 26, () => {}) : strum(x.notes);
  };
  const next = () => {
    const x = makeQuestion(mode, level, Math.random, q?.answer);
    setQ(x); setResult(null);
    play(x);
  };
  // A new mode or level: a fresh start.
  useEffect(() => { setQ(null); setResult(null); setSession({ ok: 0, n: 0 }); }, [mode, level]);

  const answer = (ok: boolean, picked?: string) => {
    if (!q || result) return;
    setResult({ ok, picked });
    countTime();
    setStats(recordAnswer(stats, q.mode, q.answer, ok));
    setSession(s => ({ ok: s.ok + (ok ? 1 : 0), n: s.n + 1 }));
  };

  const sum = summary(stats, mode);
  return (
    <Phone label="Oreille">
      <StatusBar />
      <div className="screen-body" style={{ gap: 14 }}>
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/pratiquer" />
            <div className="head-titles">
              <span className="kicker">Pratiquer</span>
              <h1 className="display" style={{ fontSize: 30 }}>OREILLE</h1>
            </div>
          </div>
          {session.n > 0 && <span className="sets-count mono" aria-label="Score de la séance">{session.ok}/{session.n}</span>}
        </div>

        <div className="seg ear-modes" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }} role="group" aria-label="Exercice">
          {MODES.map(m => <button key={m.id} className={mode === m.id ? 'on' : ''} aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>{m.label}</button>)}
        </div>
        <div className="seg" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }} role="group" aria-label="Niveau">
          {([1, 2, 3] as EarLevel[]).map(l => <button key={l} className={level === l ? 'on' : ''} aria-pressed={level === l} onClick={() => setLevels({ ...levels, [mode]: l })}>{EAR_LEVEL_FR[l]}</button>)}
        </div>

        {mode === 'play' ? <PlayChord level={level} onResult={(chord, ok) => {
          setStats(recordAnswer(stats, 'play', chord, ok));
          setSession(s => ({ ok: s.ok + (ok ? 1 : 0), n: s.n + 1 }));
        }} /> : !q ? (
          <div className="ear-start">
            <p className="help">{mode === 'intervals'
              ? 'L’app joue deux notes : nommez l’écart entre elles. Commencez par la quarte, la quinte et l’octave.'
              : mode === 'progressions'
                ? 'L’app joue quatre accords dans une tonalité au hasard : reconnaissez la suite. Écoutez la basse et repérez quand l’accord devient mineur (vi, ii) ou revient au départ (I).'
                : 'L’app gratte un accord : reconnaissez sa couleur. Majeur : clair, stable. Mineur : plus sombre.'}</p>
            {mode === 'intervals' && (
              <label className="ear-opt"><input type="checkbox" checked={together} onChange={e => setTogether(e.target.checked)} /> Les deux notes ensemble</label>
            )}
            <button className="btn-primary" onClick={next}>Commencer</button>
          </div>
        ) : (
          <div className="ear-q">
            <button className="ear-listen" onClick={() => play()} aria-label="Réécouter">▶</button>
            <span className="help">{mode === 'intervals' ? 'Quel intervalle ?' : mode === 'progressions' ? 'Quelle suite d’accords ?' : 'Quel accord ?'}</span>
            <div className="ear-choices" role="group" aria-label="Réponses">
              {q.choices.map(c => {
                const state = !result ? '' : c.id === q.answer ? ' right' : c.id === result.picked ? ' wrong' : '';
                return <button key={c.id} className={'ear-choice' + state} disabled={!!result} onClick={() => answer(c.id === q.answer, c.id)}>{c.label}</button>;
              })}
            </div>
            {result && (
              <p className={'ear-result' + (result.ok ? ' ok' : ' ko')} role="status">
                {result.ok ? 'Bonne réponse !' : `C’était : ${answerLabel(q.mode, q.answer)}.`}
              </p>
            )}
            {result && q.reveal && <p className="ear-reveal">{q.reveal}</p>}
            {result && <button className="btn-primary" onClick={next}>Suivant ›</button>}
          </div>
        )}

        {sum.n > 0 && (
          <p className="ear-stats" aria-label="Vos scores">
            Réussite <b>{sum.rate} %</b> sur {sum.n} {mode === 'play' ? (sum.n > 1 ? 'accords joués' : 'accord joué') : (sum.n > 1 ? 'questions' : 'question')}
            {sum.weakest && <> · à revoir : <b>{answerLabel(mode, sum.weakest)}</b></>}
          </p>
        )}
      </div>
      <TabBar active={2} />
    </Phone>
  );
}

/** Play the chord the app names: the microphone checks it (among the level's chords). */
function PlayChord({ level, onResult }: { level: EarLevel; onResult: (chord: string, ok: boolean) => void }) {
  const [choice, setChoice] = useStoredState<string>('ear.playChoice', '');
  const [target, setTarget] = useState<string>(() => choice || makeQuestion('play', level).chord!);
  const [state, setState] = useState<'idle' | 'listening' | 'ok' | 'denied'>('idle');
  const [heard, setHeard] = useState<string | null>(null);
  const [showShape, setShowShape] = useState(false);
  const listener = useRef<ChordListener | null>(null);
  const stop = () => { listener.current?.stop(); listener.current = null; };
  useEffect(() => stop, []);
  useEffect(() => { stop(); setState('idle'); setTarget(choice || makeQuestion('play', level, Math.random, target).chord!); }, [level, choice]); // eslint-disable-line react-hooks/exhaustive-deps

  const listen = async () => {
    stop();
    setState('listening'); setHeard(null);
    const shapes = playable(level).map(n => parseChordName(n)!).filter(Boolean);
    const frames: (string | null)[] = [];
    try {
      listener.current = await listenForChords(shapes, chord => {
        frames.push(chord);
        setHeard(chord);
        if (heardTarget(frames.slice(-12), target)) { stop(); setState('ok'); onResult(target, true); }
      });
    } catch { setState('denied'); }
  };
  const nextChord = () => { stop(); setState('idle'); setHeard(null); setShowShape(false); setTarget(choice || makeQuestion('play', level, Math.random, target).chord!); };
  const s = parseChordName(target);
  const v = s ? voicings(s.root, s.type)[0] : null;
  return (
    <div className="ear-q">
      <label className="ear-opt">Accord :
        <select value={choice} onChange={e => setChoice(e.target.value)} aria-label="Accord à jouer">
          <option value="">au hasard</option>
          {playable(level).map(c => <option key={c} value={c}>{chordFr(c)} ({c})</option>)}
        </select>
      </label>
      <span className="help">Jouez :</span>
      <span className="ear-target" aria-live="polite"><b>{chordFr(target)}</b> <span className="mono">{target}</span></span>
      {showShape && v && s ? <div className="ear-shape" data-theme="dark"><ChordDiagram v={v} root={s.root} type={s.type} labels="fingers" /></div>
        : <button className="btn-link" onClick={() => setShowShape(true)}>Voir le schéma</button>}
      {state === 'ok' ? <p className="ear-result ok" role="status">Bien joué : c’est bien {chordFr(target)} !</p>
        : state === 'denied' ? <p className="ear-result ko" role="status">Le micro n’est pas autorisé : autorisez-le pour cet exercice.</p>
        : state === 'listening' ? <p className="ear-heard" role="status">J’entends : <b>{heard ? `${chordFr(heard)} (${heard})` : '…'}</b></p>
        : null}
      {state === 'ok' ? <button className="btn-primary" onClick={nextChord}>Accord suivant ›</button>
        : state === 'listening' ? <button className="btn-outline" onClick={() => { onResult(target, false); nextChord(); }}>Je passe</button>
        : <button className="btn-primary" onClick={() => void listen()}>Écouter ma guitare</button>}
    </div>
  );
}
