import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { parseChordName } from '../lib/chordDetect';
import { listenForChords, type ChordListener } from '../lib/chordFollow';
import { Clicker } from '../lib/click';
import {
  GOALS, LEVEL_FR, MINUTES, PROFILE_KEY, SKILL_FR, STYLES, coachRoutine, countChanges, levelFromChanges, levelFromRhythm, levelFromScale,
  levels, strumSpread, type Goal, type Level, type Measures, type Profile, type Skill, type Style,
} from '../lib/coach';
import { applyCoachRoutine, coachActive, leaveCoach, ownRoutine } from '../lib/coachRoutine';
import { captureMic, type MicCapture } from '../lib/micCapture';
import { detectOnsets } from '../lib/onsets';
import { readStored, useStoredState } from '../lib/store';
import { EX_FR, PROGRESS_KEY, TESTS_KEY, compareCheckups, monthlyDue, weekReview, type Checkup, type Progress } from '../lib/coachProgress';
import { dayNumber } from '../lib/coach';
import { fmtHM, useRoutine, week } from '../lib/routine';
import { markUsed } from '../lib/usage';
import './Coach.css';

const PAIRS = [
  { label: 'Do ↔ Sol', a: 'C', b: 'G' }, { label: 'La m ↔ Mi', a: 'Am', b: 'E' }, { label: 'Ré ↔ La', a: 'D', b: 'A' },
  { label: 'Mi m ↔ Do', a: 'Em', b: 'C' }, { label: 'Sol ↔ Ré', a: 'G', b: 'D' },
];
/** Test lengths (seconds); a shorter scale can be set for automated tests. */
const testScale = () => readStored<number>('coach.testScale', 1);
const CHANGES_SECONDS = 60;
const RHYTHM = { bpm: 80, beats: 40, countIn: 4 };

type Step = 0 | 1 | 2 | 3 | 4 | 5;
const STEP_TITLES = ['Vos objectifs', 'Styles et temps', 'Test 1 · Accords', 'Test 2 · Gamme', 'Test 3 · Rythme', 'Votre programme'];

/** /pratiquer/coach — the starting check-up, then the coach's routine of the day. */
export default function Coach() {
  const nav = useNavigate();
  const [profile, setProfile] = useStoredState<Profile | null>(PROFILE_KEY, null);
  const [setup, setSetup] = useState<Step | null>(profile ? null : 0);
  const [draft, setDraft] = useState<Profile>(() => profile ?? { goals: [], styles: [], minutes: 20, measures: {}, declared: {}, date: Date.now() });
  const [, refresh] = useState(0);
  const [checkups, setCheckups] = useStoredState<Checkup[]>(TESTS_KEY, []);
  /** The monthly test (the three tests again, compared with the previous check-ups). */
  const [monthly, setMonthly] = useState(false);
  useEffect(() => markUsed('coach'), []);

  const patch = (p: Partial<Profile>) => setDraft(d => ({ ...d, ...p }));
  const measure = (m: Partial<Measures>, skill: Skill) =>
    setDraft(d => { const declared = { ...d.declared }; delete declared[skill]; return { ...d, measures: { ...d.measures, ...m }, declared }; });
  const declare = (skill: Skill, lv: Level) =>
    setDraft(d => {
      const measures = { ...d.measures };
      if (skill === 'chords') { delete measures.changes; delete measures.pair; }
      if (skill === 'technique') delete measures.scaleBpm;
      if (skill === 'rhythm') delete measures.rhythmMs;
      return { ...d, measures, declared: { ...d.declared, [skill]: lv } };
    });
  const finish = () => {
    const p = { ...draft, date: Date.now() };
    // The first check-up of a player who started before the history was kept counts as the start.
    const past = checkups.length ? checkups : profile ? [{ date: profile.date, measures: profile.measures }] : [];
    setCheckups([...past, { date: p.date, measures: p.measures }]);
    setProfile(p); setDraft(p); setSetup(5);
  };
  // Fresh tests: last month's results are not shown again (they stay in the history to compare).
  const startMonthly = () => { if (profile) { setDraft({ ...profile, measures: {} }); setMonthly(true); setSetup(2); } };
  const use = () => { applyCoachRoutine(profile ?? draft); nav('/pratiquer/routine'); };

  if (setup !== null) {
    const step = setup;
    const next = () => setSetup((step + 1) as Step);
    const canNext = step === 0 ? draft.goals.length > 0 : step === 1 ? draft.styles.length > 0 : true;
    return (
      <Phone label="Coach">
        <StatusBar />
        <div className="screen-body coach-body" style={{ gap: 14 }}>
          <div className="head">
            <div className="head-l">
              <BackButton fallback="/pratiquer" />
              <div className="head-titles">
                <span className="kicker">{monthly ? `Test du mois · ${step < 5 ? `${step - 1}/3` : 'résultats'}` : `Coach · ${step < 5 ? `étape ${step + 1}/5` : 'bilan'}`}</span>
                <h1 className="display" style={{ fontSize: 26 }}>{STEP_TITLES[step].toUpperCase()}</h1>
              </div>
            </div>
          </div>
          {step < 5 && !monthly && <div className="coach-dots" aria-hidden>{[0, 1, 2, 3, 4].map(i => <span key={i} className={i <= step ? 'on' : ''} />)}</div>}

          {step === 0 && (
            <>
              <p className="coach-help">Ce que vous voulez travailler (plusieurs choix possibles).</p>
              <div className="coach-options" role="group" aria-label="Objectifs">
                {GOALS.map(g => {
                  const on = draft.goals.includes(g.id);
                  return (
                    <button key={g.id} className={'coach-opt' + (on ? ' on' : '')} aria-pressed={on}
                      onClick={() => patch({ goals: on ? draft.goals.filter(x => x !== g.id) : [...draft.goals, g.id as Goal] })}>
                      <span className="coach-opt-name">{g.label}</span><span className="coach-opt-sub">{g.sub}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <p className="coach-help">Les styles que vous aimez jouer.</p>
              <div className="coach-chips" role="group" aria-label="Styles">
                {STYLES.map(s => {
                  const on = draft.styles.includes(s.id);
                  return <button key={s.id} className={'ng-chip' + (on ? ' on' : '')} aria-pressed={on} onClick={() => patch({ styles: on ? draft.styles.filter(x => x !== s.id) : [...draft.styles, s.id as Style] })}>{s.label}</button>;
                })}
              </div>
              <p className="coach-help">Le temps que vous avez par jour.</p>
              <div className="seg" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }} role="group" aria-label="Temps par jour">
                {MINUTES.map(m => <button key={m} className={draft.minutes === m ? 'on' : ''} aria-pressed={draft.minutes === m} onClick={() => patch({ minutes: m })}>{m} min</button>)}
              </div>
            </>
          )}

          {step === 2 && <ChangesTest draft={draft} onResult={(changes, pair) => measure({ changes, pair }, 'chords')} onDeclare={lv => declare('chords', lv)} />}
          {step === 3 && <ScaleTest draft={draft} onResult={bpm => measure({ scaleBpm: bpm }, 'technique')} onDeclare={lv => declare('technique', lv)} />}
          {step === 4 && <RhythmTest draft={draft} onResult={ms => measure({ rhythmMs: ms }, 'rhythm')} onDeclare={lv => declare('rhythm', lv)} />}

          {step === 5 && monthly && checkups.length > 1 && <Changes from={checkups[checkups.length - 2]} to={checkups[checkups.length - 1]} title="Depuis le dernier test" />}
          {step === 5 && profile && <Summary p={profile} />}

          <div className="coach-nav">
            {step > 0 && step < 5 && <button className="btn-outline" onClick={() => (monthly && step === 2 ? (setMonthly(false), setSetup(null)) : setSetup((step - 1) as Step))}>‹ Retour</button>}
            {step < 4 && <button className="btn-primary" disabled={!canNext} onClick={next}>Suivant ›</button>}
            {step === 4 && <button className="btn-primary" onClick={finish}>{monthly ? 'Voir mes progrès ›' : 'Voir mon programme ›'}</button>}
            {step === 5 && <button className="btn-primary" onClick={use}>Utiliser cette routine aujourd’hui</button>}
            {step === 5 && <button className="btn-outline" onClick={() => { setMonthly(false); setSetup(null); }}>{monthly ? 'Terminer' : 'Plus tard'}</button>}
          </div>
        </div>
        <TabBar active={2} />
      </Phone>
    );
  }

  const p = profile!;
  const active = coachActive();
  return (
    <Phone label="Coach">
      <StatusBar />
      <div className="screen-body coach-body" style={{ gap: 14 }}>
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/pratiquer" />
            <div className="head-titles">
              <span className="kicker">Pratiquer</span>
              <h1 className="display" style={{ fontSize: 30 }}>COACH</h1>
            </div>
          </div>
        </div>
        <WeekCard />
        <MonthCard p={p} checkups={checkups} onStart={startMonthly} />
        <Summary p={p} />
        <div className="coach-nav">
          {active
            ? <button className="btn-primary" onClick={() => nav('/pratiquer/routine')}>Ouvrir la routine du jour ›</button>
            : <button className="btn-primary" onClick={use}>Utiliser cette routine aujourd’hui</button>}
          {active && ownRoutine() && <button className="btn-outline" onClick={() => { leaveCoach(); refresh(n => n + 1); }}>Revenir à ma routine</button>}
          <button className="btn-outline" onClick={() => { setDraft(p); setSetup(0); }}>Refaire le bilan</button>
        </div>
        {active && <p className="coach-help">Chaque jour, le coach compose une nouvelle routine dans Pratiquer › Routine du jour.</p>}
      </div>
      <TabBar active={2} />
    </Phone>
  );
}

/** Levels per skill (with what was measured) and the routine of the day. */
function Summary({ p }: { p: Profile }) {
  const lv = levels(p);
  const m = p.measures;
  const how: Record<Skill, string> = {
    chords: m.changes !== undefined ? `${m.changes} changements / min (${m.pair})` : 'niveau indiqué',
    technique: m.scaleBpm !== undefined ? `penta en croches à ${m.scaleBpm} BPM` : 'niveau indiqué',
    rhythm: m.rhythmMs !== undefined ? `± ${m.rhythmMs} ms autour du clic` : 'niveau indiqué',
  };
  const steps = coachRoutine(p, dayNumber(), readStored<Progress>(PROGRESS_KEY, {}));
  return (
    <>
      <div className="coach-levels" role="list" aria-label="Vos niveaux">
        {(['chords', 'technique', 'rhythm'] as Skill[]).map(s => (
          <div key={s} className="coach-level" role="listitem">
            <span className="coach-skill">{SKILL_FR[s]}</span>
            <span className={`coach-badge l${lv[s]}`}>{LEVEL_FR[lv[s]]}</span>
            <span className="coach-how">{how[s]}</span>
          </div>
        ))}
      </div>
      <div className="coach-routine">
        <div className="coach-routine-head"><span className="kicker">Routine du jour</span><span className="mono">{p.minutes} min</span></div>
        {steps.map((s, i) => (
          <div key={s.id} className="coach-step">
            <span className="coach-step-n">{i + 1}</span>
            <div className="coach-step-text">
              <span className="coach-step-name">{s.name} <span className="mono">· {s.min} min</span></span>
              <span className="coach-step-detail">{s.detail}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/** « Je préfère me situer » : the level, without the test. */
function Declare({ skill, draft, onDeclare }: { skill: Skill; draft: Profile; onDeclare: (lv: Level) => void }) {
  const cur = draft.declared[skill];
  return (
    <div className="coach-declare">
      <span className="coach-help">Sans le test, je me situe :</span>
      <div className="seg" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }} role="group" aria-label={`Mon niveau : ${SKILL_FR[skill]}`}>
        {([1, 2, 3] as Level[]).map(l => <button key={l} className={cur === l ? 'on' : ''} aria-pressed={cur === l} onClick={() => onDeclare(l)}>{LEVEL_FR[l]}</button>)}
      </div>
    </div>
  );
}

/* ---------- Test 1: one-minute changes ---------- */

function ChangesTest({ draft, onResult, onDeclare }: { draft: Profile; onResult: (n: number, pair: string) => void; onDeclare: (lv: Level) => void }) {
  const [pairIdx, setPairIdx] = useState(0);
  const [left, setLeft] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const mic = useRef<ChordListener | null>(null);
  useEffect(() => () => mic.current?.stop(), []);
  const pair = PAIRS[pairIdx];
  const done = draft.measures.changes !== undefined;

  const start = async () => {
    setErr(null); setCount(0);
    const secs = Math.round(CHANGES_SECONDS * testScale());
    const heard: (string | null)[] = [];
    const cands = [parseChordName(pair.a)!, parseChordName(pair.b)!];
    try {
      let t0: number | null = null;
      mic.current = await listenForChords(cands, (chord, ms) => {
        t0 ??= ms;
        heard.push(chord);
        setCount(countChanges(heard, pair.a, pair.b));
        const rest = Math.max(0, secs - Math.floor((ms - t0) / 1000));
        setLeft(rest);
        if (ms - t0 >= secs * 1000) {
          mic.current?.stop(); mic.current = null; setLeft(null);
          onResult(Math.round(countChanges(heard, pair.a, pair.b) * (60 / secs)), pair.label);
        }
      });
      setLeft(secs);
    } catch { setErr('Micro refusé : autorisez-le, ou indiquez votre niveau ci-dessous.'); }
  };
  const lv = done ? levelFromChanges(draft.measures.changes!) : null;

  return (
    <div className="coach-test">
      <p className="coach-help">Pendant une minute, passez d’un accord à l’autre le plus vite possible, en grattant chaque accord : l’app compte les changements propres qu’elle entend.</p>
      <label className="sheet-field">
        <span>Les deux accords</span>
        <select className="text-input" value={pairIdx} disabled={left !== null} onChange={e => setPairIdx(Number(e.target.value))}>
          {PAIRS.map((p, i) => <option key={p.label} value={i}>{p.label}</option>)}
        </select>
      </label>
      <div className="coach-meter" role="status">
        {left !== null ? <><b className="mono">{count}</b><span>changements · {left} s</span></>
          : done ? <><b className="mono">{draft.measures.changes}</b><span>changements par minute · {LEVEL_FR[lv!]}</span></>
          : <span>Prêt ? Posez les doigts sur {pair.label.split(' ↔ ')[0]}.</span>}
      </div>
      {left === null
        ? <button className="btn-primary" onClick={() => void start()}>{done ? 'Refaire le test' : 'Commencer (1 minute)'}</button>
        : <button className="btn-outline" onClick={() => { mic.current?.stop(); mic.current = null; setLeft(null); }}>Arrêter</button>}
      {err && <p className="backup-msg error" role="alert">{err}</p>}
      <Declare skill="chords" draft={draft} onDeclare={onDeclare} />
    </div>
  );
}

/* ---------- Test 2: pentatonic at the click ---------- */

function ScaleTest({ draft, onResult, onDeclare }: { draft: Profile; onResult: (bpm: number) => void; onDeclare: (lv: Level) => void }) {
  const [bpm, setBpm] = useState<number | null>(null);
  const click = useRef<Clicker | null>(null);
  useEffect(() => () => click.current?.dispose(), []);
  const done = draft.measures.scaleBpm !== undefined;
  const play = (b: number) => { click.current ??= new Clicker(); click.current.start(b); setBpm(b); };
  const stop = () => { click.current?.stop(); setBpm(null); };
  const ok = () => { if (bpm === null) return; if (bpm >= 160) { stop(); onResult(160); } else play(bpm + 10); };
  const tooHard = () => { if (bpm === null) return; stop(); onResult(Math.max(40, bpm - 10)); };

  return (
    <div className="coach-test">
      <p className="coach-help">Jouez la penta mineure de La (position 1, cases 5 à 8) en croches : deux notes par clic, montée et descente. Tant que c’est propre, le tempo monte de 10.</p>
      <div className="coach-meter" role="status">
        {bpm !== null ? <><b className="mono">{bpm}</b><span>BPM · deux notes par clic</span></>
          : done ? <><b className="mono">{draft.measures.scaleBpm}</b><span>BPM propre · {LEVEL_FR[levelFromScale(draft.measures.scaleBpm!)]}</span></>
          : <span>On commence à 60 BPM.</span>}
      </div>
      {bpm === null
        ? <button className="btn-primary" onClick={() => play(60)}>{done ? 'Refaire le test' : 'Commencer à 60 BPM'}</button>
        : <div className="confirm-row">
            <button className="btn-outline" onClick={tooHard}>Trop dur ✗</button>
            <button className="btn-primary" onClick={ok}>Propre ✓ (plus vite)</button>
          </div>}
      <Declare skill="technique" draft={draft} onDeclare={onDeclare} />
    </div>
  );
}

/* ---------- Test 3: strumming with the click ---------- */

function RhythmTest({ draft, onResult, onDeclare }: { draft: Profile; onResult: (ms: number) => void; onDeclare: (lv: Level) => void }) {
  const [phase, setPhase] = useState<'idle' | 'count' | 'play' | 'analyse'>('idle');
  const [err, setErr] = useState<string | null>(null);
  const res = useRef<{ click: Clicker | null; mic: MicCapture | null; timer: number }>({ click: null, mic: null, timer: 0 });
  useEffect(() => () => { const r = res.current; clearTimeout(r.timer); r.mic?.stop(); r.click?.dispose(); }, []);
  const done = draft.measures.rhythmMs !== undefined;
  const beats = Math.max(10, Math.round(RHYTHM.beats * testScale()));

  const start = async () => {
    setErr(null);
    const r = res.current;
    r.click?.dispose();
    const click = new Clicker();
    r.click = click;
    try { r.mic = await captureMic(click.ac); }
    catch { setErr('Micro refusé : autorisez-le, ou indiquez votre niveau ci-dessous.'); return; }
    const beat = 60 / RHYTHM.bpm;
    const t0 = click.start(RHYTHM.bpm, 4);
    const first = t0 + RHYTHM.countIn * beat;
    const end = first + beats * beat;
    setPhase('count');
    r.timer = window.setTimeout(() => setPhase('play'), (first - click.ac.currentTime) * 1000);
    const finish = () => {
      if (click.ac.currentTime < end + 0.3) { r.timer = window.setTimeout(finish, 100); return; }
      click.stop(); setPhase('analyse');
      const from = first - 0.3;
      const samples = r.mic!.between(from, end + 0.2);
      r.mic!.stop(); r.mic = null;
      const clicks = click.times.filter(t => t >= first - 1e-6 && t < end - 1e-6);
      const s = strumSpread(detectOnsets(samples, click.ac.sampleRate, from), clicks);
      setPhase('idle');
      if (!s) setErr('Trop peu de coups entendus : rapprochez le téléphone de la guitare et grattez franchement, à chaque clic.');
      else onResult(s.spread);
    };
    r.timer = window.setTimeout(finish, (end - click.ac.currentTime) * 1000);
  };

  return (
    <div className="coach-test">
      <p className="coach-help">Grattez un accord à chaque clic (une fois par temps), à {RHYTHM.bpm} BPM, après 4 clics de décompte. L’app mesure si vos coups tombent régulièrement avec le clic.</p>
      <div className="coach-meter" role="status">
        {phase === 'count' ? <span>Décompte… prêt à gratter</span>
          : phase === 'play' ? <span>Grattez à chaque clic…</span>
          : phase === 'analyse' ? <span>Analyse…</span>
          : done ? <><b className="mono">± {draft.measures.rhythmMs}</b><span>ms autour du clic · {LEVEL_FR[levelFromRhythm(draft.measures.rhythmMs!)]}</span></>
          : <span>Un casque n’est pas nécessaire : le clic sert de repère.</span>}
      </div>
      {phase === 'idle' && <button className="btn-primary" onClick={() => void start()}>{done ? 'Refaire le test' : `Commencer (${Math.round((beats * 60) / RHYTHM.bpm)} s)`}</button>}
      {err && <p className="backup-msg error" role="alert">{err}</p>}
      <Declare skill="rhythm" draft={draft} onDeclare={onDeclare} />
    </div>
  );
}

/** The last seven days: minutes, days played, tempos gained, and a piece of advice. */
function WeekCard() {
  const r = useRoutine();
  const [progress] = useStoredState<Progress>(PROGRESS_KEY, {});
  const w = weekReview(progress, week(r).map(d => d.min), dayNumber());
  return (
    <section className="coach-panel" aria-label="Bilan de la semaine">
      <span className="kicker">Bilan de la semaine</span>
      <div className="coach-week-nums">
        <div><b className="mono">{fmtHM(w.minutes)}</b><span>de pratique</span></div>
        <div><b className="mono">{w.days}/7</b><span>jours joués</span></div>
      </div>
      {w.tempos.length > 0 && (
        <ul className="coach-tempos">
          {w.tempos.map(t => (
            <li key={t.ex}><span>{EX_FR[t.ex]}</span><span className="mono">{t.from} → {t.to} BPM</span>
              <b className={t.to > t.from ? 'up' : t.to < t.from ? 'down' : ''}>{t.to > t.from ? `+${t.to - t.from}` : t.to < t.from ? `${t.to - t.from}` : '='}</b></li>
          ))}
        </ul>
      )}
      <p className="coach-advice">{w.advice}</p>
    </section>
  );
}

/** The monthly test: when it is due, and what changed since the first check-up. */
function MonthCard({ p, checkups, onStart }: { p: Profile; checkups: Checkup[]; onStart: () => void }) {
  const last = checkups[checkups.length - 1]?.date ?? p.date;
  const { due, inDays } = monthlyDue(last);
  return (
    <section className="coach-panel" aria-label="Test du mois">
      <span className="kicker">Test du mois</span>
      {due
        ? <><p className="coach-help">Quatre semaines ont passé : refaites les 3 tests (5 minutes) pour mesurer vos progrès. Le coach adaptera vos niveaux.</p>
            <button className="btn-primary" onClick={onStart}>Passer le test du mois</button></>
        : <p className="coach-help">Prochain test dans {inDays} jour{inDays > 1 ? 's' : ''}. <button className="btn-link small inline" onClick={onStart}>Le passer maintenant</button></p>}
      {checkups.length > 1 && <Changes from={checkups[0]} to={checkups[checkups.length - 1]} title="Depuis le bilan de départ" />}
    </section>
  );
}

const fmtDay = (t: number) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(t);
function Changes({ from, to, title }: { from: Checkup; to: Checkup; title: string }) {
  const list = compareCheckups(from.measures, to.measures);
  if (!list.length) return null;
  return (
    <div className="coach-changes">
      <span className="coach-skill">{title} <span className="mono">({fmtDay(from.date)} → {fmtDay(to.date)})</span></span>
      <ul>
        {list.map(c => (
          <li key={c.skill}><span>{c.label}</span><span className="mono">{c.from} → {c.to} {c.unit}</span>
            <b className={c.better ? 'up' : c.from === c.to ? '' : 'down'}>{c.better ? '▲' : c.from === c.to ? '=' : '▼'}</b></li>
        ))}
      </ul>
    </div>
  );
}
