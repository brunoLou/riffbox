import { useNavigate } from 'react-router-dom';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { ROUTINE, ROUTINE_MIN, doneSeconds, mmss, routine, useRoutine } from '../lib/routine';
import './Routine.css';

export default function Routine() {
  const nav = useNavigate();
  const r = useRoutine();
  const step = ROUTINE[r.step];
  const len = step.min * 60;
  const left = Math.max(0, len - r.elapsed[r.step]);
  const frac = r.done ? 1 : r.elapsed[r.step] / len;

  return (
    <Phone label="07b Routine">
      <StatusBar />
      <div className="screen-body" style={{ gap: 12 }}>
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/pratiquer" />
            <div className="head-titles">
              <span className="kicker">Routine du jour · {ROUTINE_MIN} min</span>
              <span className="display" style={{ fontSize: 28 }}>{r.done ? 'TERMINÉE' : `ÉTAPE ${r.step + 1}/${ROUTINE.length}`}</span>
            </div>
          </div>
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
          <p>{r.done ? 'Les quatre étapes sont faites. À demain pour la suite de la série !' : step.detail}</p>
          {!r.done && step.link && <button className="rlink" onClick={() => nav(step.link!.to)}>{step.link.label} ›</button>}
        </div>

        <div className="rlist">
          {ROUTINE.map((s, i) => {
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
        <button className="page-btn" disabled={r.step === 0 && !r.done} onClick={() => routine.goto(r.done ? ROUTINE.length - 1 : r.step - 1)}>‹ Étape</button>
        {r.done
          ? <button className="play-btn on" onClick={() => routine.restart()} style={{ fontSize: 14 }}>REJOUER</button>
          : <button className={'play-btn' + (r.running ? ' on' : '')} onClick={() => (r.running ? routine.pause() : routine.start())}>{r.running ? 'PAUSE' : 'GO'}</button>}
        <button className="page-btn" disabled={r.done || r.step === ROUTINE.length - 1} onClick={() => routine.goto(r.step + 1)}>Étape ›</button>
      </div>
      <TabBar active={2} />
    </Phone>
  );
}
