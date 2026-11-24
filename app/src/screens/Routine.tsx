import { useNavigate } from 'react-router-dom';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { usePedal } from '../lib/pedal';
import { doneSeconds, mmss, routine, useRoutine, routineMin, routineSteps, type RoutineStep } from '../lib/routine';
import { useStoredState, writeStored } from '../lib/store';
import { dayNumber } from '../lib/coach';
import { EX_FR, FEEL_FR, PROGRESS_KEY, exOfStep, feelToday, recordFeel, type Feel, type Progress } from '../lib/coachProgress';
import { useEffect } from 'react';
import { refreshCoachRoutine } from '../lib/coachRoutine';
import './Routine.css';

export default function Routine() {
  const nav = useNavigate();
  useEffect(() => refreshCoachRoutine(), []);
  /** Opens a step's tool, set up for the exercise (tempo, scale, backing track…). */
  const openLink = (l: NonNullable<RoutineStep['link']>) => {
    for (const [k, v] of Object.entries(l.set ?? {})) writeStored(k, v);
    nav(l.to);
  };
  const r = useRoutine();
  const step = routineSteps()[r.step];
  const len = step.min * 60;
  const left = Math.max(0, len - r.elapsed[r.step]);
  const frac = r.done ? 1 : r.elapsed[r.step] / len;

  const goPause = () => (r.done ? routine.restart() : r.running ? routine.pause() : routine.start());
  usePedal({
    right: () => { if (!r.done && r.step < routineSteps().length - 1) routine.goto(r.step + 1); },
    left: goPause,
    middle: goPause,
  });

  return (
    <Phone label="07b Routine">
      <StatusBar />
      <div className="screen-body" style={{ gap: 12 }}>
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/pratiquer" />
            <div className="head-titles">
              <span className="kicker">Routine du jour · {routineMin()} min</span>
              <h1 className="display" style={{ fontSize: 28 }}>{r.done ? 'TERMINÉE' : `ÉTAPE ${r.step + 1}/${routineSteps().length}`}</h1>
            </div>
          </div>
          <button className="edit-btn" onClick={() => nav('/pratiquer/routine/modifier')}>Modifier</button>
        </div>

        <div data-theme="dark" className={'rring' + (r.done ? ' done' : '') + (r.running ? ' running' : '')}
          style={{ background: `conic-gradient(${r.done ? 'var(--led)' : 'var(--amber)'} 0turn ${frac}turn, #3a3530 ${frac}turn 1turn)` }}>
          <div className="rring-cap">
            <span className="rring-name">{r.done ? 'Bravo' : step.name}</span>
            <span className="rring-time">{r.done ? mmss(doneSeconds(r)) : mmss(left)}</span>
            <span className="rring-sub mono">{r.done ? 'de pratique aujourd’hui' : `sur ${step.min}:00`}</span>
          </div>
        </div>

        <div className="rdetail">
          <p>{r.done ? `${routineSteps().length > 1 ? `Les ${routineSteps().length} étapes sont faites` : 'L’étape est faite'}. À demain pour la suite de la série !` : step.detail}</p>
          {!r.done && step.link && <button className="rlink" onClick={() => openLink(step.link!)}>{step.link.label} ›</button>}
        </div>
        {!r.done && <CoachFeel step={step} />}

        <div className="rlist">
          {routineSteps().map((s, i) => {
            const done = r.elapsed[i] >= s.min * 60;
            const cur = i === r.step && !r.done;
            return (
              <button key={s.id} className={'rlist-row' + (done ? ' done' : '') + (cur ? ' cur' : '')} onClick={() => routine.goto(i)} aria-current={cur ? 'step' : undefined}>
                <span className="rstep-dot">{done ? '✓' : i + 1}</span>
                <span className="rlist-name">{s.name}</span>
                <span className="rlist-time mono">{mmss(r.elapsed[i])} / {s.min}:00</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rtransport">
        <button className="page-btn" disabled={r.step === 0 && !r.done} onClick={() => routine.goto(r.done ? routineSteps().length - 1 : r.step - 1)}>‹ Étape</button>
        {r.done
          ? <button className="play-btn on" onClick={() => routine.restart()} style={{ fontSize: 14 }}>REJOUER</button>
          : <button className={'play-btn' + (r.running ? ' on' : '')} onClick={() => (r.running ? routine.pause() : routine.start())}>{r.running ? 'PAUSE' : 'GO'}</button>}
        <button className="page-btn" disabled={r.done || r.step === routineSteps().length - 1} onClick={() => routine.goto(r.step + 1)}>Étape ›</button>
      </div>
      <TabBar active={2} />
    </Phone>
  );
}

/**
 * After a coach exercise with a tempo: how it went. The coach raises the tempo when it is easy,
 * keeps it when it is « juste », lowers it when it is hard.
 */
function CoachFeel({ step }: { step: RoutineStep }) {
  const [progress, setProgress] = useStoredState<Progress>(PROGRESS_KEY, {});
  const ex = exOfStep(step.id);
  const played = Number(step.link?.set?.['metro.bpm']);
  if (!ex || !played) return null;
  const day = dayNumber();
  const today = feelToday(progress, ex, day);
  const next = progress[ex]?.bpm;
  return (
    <div className="coach-feel" role="group" aria-label={`${EX_FR[ex]} à ${played} BPM : comment c’était ?`}>
      <span className="coach-feel-q">À {played} BPM, c’était :</span>
      <div className="seg" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
        {(['easy', 'ok', 'hard'] as Feel[]).map(f => (
          <button key={f} className={today === f ? 'on' : ''} aria-pressed={today === f}
            onClick={() => setProgress(recordFeel(progress, ex, played, f, day))}>{FEEL_FR[f]}</button>
        ))}
      </div>
      {today && next !== undefined && (
        <span className="coach-feel-next" role="status">
          {next > played ? `Prochaine fois : ${next} BPM (+${next - played}).` : next < played ? `Prochaine fois : ${next} BPM, pour jouer propre.` : `Prochaine fois : toujours ${next} BPM.`}
        </span>
      )}
    </div>
  );
}
