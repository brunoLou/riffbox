import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, StatusBar, TabBar } from '../components/Chrome';
import { PedalTile } from '../components/PedalTile';
import { TILES } from '../lib/data';
import { subFor } from '../lib/tileSub';
import { useUsedToday } from '../lib/usage';
import { doneSeconds, fmtHM, routine, streak, useRoutine, week, routineMin, routineSteps } from '../lib/routine';
import { readStored } from '../lib/store';
import './Pratiquer.css';
import { useEffect } from 'react';
import { PROFILE_KEY, type Profile } from '../lib/coach';
import { coachActive, refreshCoachRoutine } from '../lib/coachRoutine';

const CHART_H = 112;
/** The practice tools, drawn as the same pedals as on the home board (id, wide). */
const PRAT_TOOLS: [string, boolean][] = [
  ['manche', false], ['accords', false], ['backing', true], ['looper', false], ['relever', false],
  ['oreille', false], ['detect', false], ['rythme', false], ['voix', false],
];
const byId = new Map(TILES.map(t => [t.id, t]));

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
  const coached = !!readStored<Profile | null>(PROFILE_KEY, null);
  useEffect(() => refreshCoachRoutine(), []);
  const doneMin = Math.floor(doneSeconds(r) / 60);
  const streakDays = streak(r).days;
  const started = doneSeconds(r) > 0;
  const used = useUsedToday();

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

        <button className="coach-card" onClick={() => nav('/pratiquer/coach')}>
          <span className="coach-card-name">Coach</span>
          <span className="coach-card-sub">{coached ? 'Votre programme : niveaux et routine du jour ›' : 'Un programme adapté à votre niveau : faites le bilan (5 min) ›'}</span>
        </button>

        <div className="routine-card">
          <div className="routine-card-head">
            <span className="routine-kicker">Routine du jour{coachActive() ? ' · coach' : ''}</span>
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

        <button className="off-card" onClick={() => nav('/pratiquer/sans-guitare')}>
          <span className="off-card-name">Pas de guitare sous la main ?</span>
          <span className="off-card-sub">Séance sans guitare · théorie et oreille, 10 min ›</span>
        </button>

        <div className="pedal-grid prat-pedals">
          {PRAT_TOOLS.map(([id, wide]) => {
            const t = byId.get(id)!;
            return <PedalTile key={id} t={{ ...t, sub: subFor(t, r), on: used.has(id) }} wide={wide} onOpen={() => nav(t.to)} />;
          })}
        </div>

        <WeekChart days={week(r)} />
        <button className="btn-outline" onClick={() => nav('/pratiquer/progres')}>Voir mes progrès ›</button>
      </div>
      <TabBar active={2} />
    </Phone>
  );
}
