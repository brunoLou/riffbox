import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, StatusBar, TabBar } from '../components/Chrome';
import { TRACKS } from '../lib/backing';
import { scaleDef } from '../lib/scales';
import { KEY_FR } from '../lib/music';
import { doneSeconds, fmtHM, routine, streak, useRoutine, week, routineMin, routineSteps } from '../lib/routine';
import { readStored } from '../lib/store';
import './Pratiquer.css';

const CHART_H = 112;

function WeekChart({ days }: { days: ReturnType<typeof week> }) {
  const [sel, setSel] = useState(days.length - 1);
  const max = Math.max(routineMin() * 1.4, ...days.map(d => d.min));
  const y = (m: number) => (m / max) * CHART_H;
  const total = days.reduce((t, d) => t + d.min, 0);
  const s = days[sel];
  return (
    <div className="week card">
      <div className="week-head">
        <span className="week-title">Cette semaine</span>
        <span className="week-total"><b>{fmtHM(total)}</b> de pratique</span>
      </div>
      <div className="week-plot" style={{ height: CHART_H }}>
        <div className="week-goal" style={{ bottom: y(routineMin()) }}><span>Objectif {routineMin()} min</span></div>
        {days.map((d, i) => (
          <button
            key={i}
            className={'week-col' + (i === sel ? ' sel' : '')}
            onClick={() => setSel(i)}
            aria-label={`${d.long} : ${d.min} minutes`}
            aria-pressed={i === sel}
          >
            {i === sel && <span className="week-val" style={{ bottom: Math.max(y(d.min), 0) + 6 }}>{d.min} min</span>}
            <span className={'week-bar' + (d.today ? ' today' : '')} style={{ height: d.min ? Math.max(4, y(d.min)) : 0 }} />
          </button>
        ))}
      </div>
      <div className="week-axis">
        {days.map((d, i) => <span key={i} className={(d.today ? 'today' : '') + (i === sel ? ' sel' : '')}>{d.today ? 'Auj.' : d.label}</span>)}
      </div>
      <div className="week-foot">{s.long}{s.today ? ' (aujourd’hui)' : ''} · {s.min} min{s.min >= routineMin() ? ' · objectif atteint' : ''}</div>
    </div>
  );
}

export default function Pratiquer() {
  const nav = useNavigate();
  const r = useRoutine();
  const doneMin = Math.floor(doneSeconds(r) / 60);
  const streakDays = streak(r).days;
  const started = doneSeconds(r) > 0;
  const scaleKey = readStored('scale.key', 9);
  const scale = scaleDef(readStored('scale.id', readStored('scale.maj', false) ? 'pmaj' : 'pmin'));

  const action = r.done ? 'Recommencer la routine' : r.running ? 'Continuer · étape en cours' : started ? `▶  Reprendre · étape ${r.step + 1}/${routineSteps().length}` : '▶  Démarrer la routine';
  const go = () => { if (r.done) routine.restart(); nav('/pratiquer/routine'); };

  return (
    <Phone label="07a Pratiquer">
      <StatusBar />
      <div className="prat-scroll">
        <div className="head">
          <div className="head-titles">
            <span className="kicker">Pratiquer</span>
            <h1 className="display" style={{ fontSize: 30 }}>PRATIQUER</h1>
          </div>
          <span className="prat-streak mono"><span />{streakDays} {streakDays > 1 ? 'jours' : 'jour'}</span>
        </div>

        <div className="routine-card">
          <div className="routine-card-head">
            <span className="routine-kicker">Routine du jour</span>
            <span className="routine-head-r">
              <span className="mono routine-total">{doneMin}/{routineMin()} min</span>
              <button className="routine-edit" onClick={() => nav('/pratiquer/routine/modifier')}>Modifier</button>
            </span>
          </div>
          <div className="routine-steps">
            {routineSteps().map((s, i) => {
              const state = r.elapsed[i] >= s.min * 60 ? 'done' : i === r.step && !r.done ? 'cur' : '';
              return (
                <div key={s.id} className={'rstep ' + state}>
                  <span className="rstep-dot">{state === 'done' ? '✓' : i + 1}</span>
                  <span className="rstep-name">{s.name}</span>
                  <span className="rstep-min mono">{s.min} min</span>
                </div>
              );
            })}
          </div>
          <div className="progress"><div style={{ width: `${(doneSeconds(r) / (routineMin() * 60)) * 100}%` }} /></div>
          <button className="routine-go" onClick={go}>{action}</button>
        </div>

        <div className="prat-tools">
          <button className="prat-tool" onClick={() => nav('/pratiquer/gammes')}>
            <span className="led on prat-tool-led" />
            <span className="prat-tool-name">Gammes</span>
            <span className="prat-tool-sub">{KEY_FR[scaleKey]} {scale.fr}</span>
          </button>
          <button className="prat-tool" onClick={() => nav('/pratiquer/accords')}>
            <span className="led on prat-tool-led" />
            <span className="prat-tool-name">Accords</span>
            <span className="prat-tool-sub">17 types · formes CAGED</span>
          </button>
          <button className="prat-tool wood" style={{ gridColumn: 'span 2' }} onClick={() => nav('/pratiquer/backing')}>
            <span className="led prat-tool-led" />
            <span className="prat-tool-name">Backing tracks</span>
            <span className="prat-tool-sub">{TRACKS.length} pistes · blues, rock, funk</span>
          </button>
          <button className="prat-tool wood" style={{ gridColumn: 'span 2' }} onClick={() => nav('/outils/ton')}>
            <span className="led prat-tool-led" />
            <span className="prat-tool-name">Quel ton ?</span>
            <span className="prat-tool-sub">Trouver la tonalité d’un morceau à l’écoute</span>
          </button>
          <button className="prat-tool cream" style={{ gridColumn: 'span 2' }} onClick={() => nav('/voix')}>
            <span className="led on prat-tool-led" />
            <span className="prat-tool-name">Justesse vocale</span>
            <span className="prat-tool-sub">Accordeur vocal, échauffements, mélodies, tessiture</span>
          </button>
        </div>

        <WeekChart days={week(r)} />
      </div>
      <TabBar active={2} />
    </Phone>
  );
}
