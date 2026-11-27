import { useState, type PointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { EX_FR, PROGRESS_KEY, TESTS_KEY, compareCheckups, type Checkup, type Progress, type TempoEx } from '../lib/coachProgress';
import { EAR_STATS_KEY, summary, type EarStats } from '../lib/ear';
import { dateOfDay, tempoSeries, weeklyMinutes, type TempoPoint } from '../lib/progressStats';
import { dayKey, doneSeconds, fmtHM, useRoutine } from '../lib/routine';
import { OFF_KEY, offMinutes, withOff, type OffLog } from '../lib/offGuitar';
import { THEORY_KIND_FR, THEORY_STATS_KEY, theorySummary, type TheoryStats } from '../lib/theory';
import { useStoredState } from '../lib/store';
import './Pratiquer.css';
import './Progres.css';

const fmtDay = (d: Date) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(d);
const FEEL: Record<string, string> = { easy: 'facile', ok: 'juste', hard: 'difficile' };

/** /pratiquer/progres — practice per week, tempos reached, check-ups and ear training over time. */
export default function Progres() {
  const nav = useNavigate();
  const r = useRoutine();
  const [log] = useStoredState<Record<string, number>>('practice.log', {});
  const [progress] = useStoredState<Progress>(PROGRESS_KEY, {});
  const [checkups] = useStoredState<Checkup[]>(TESTS_KEY, []);
  const [ear] = useStoredState<EarStats>(EAR_STATS_KEY, {});
  const [off] = useStoredState<OffLog>(OFF_KEY, {});
  const [theory] = useStoredState<TheoryStats>(THEORY_STATS_KEY, {});
  // Practice without a guitar (theory, ear) is added day by day.
  const weeks = weeklyMinutes(withOff(log, off), new Date(), Math.floor(doneSeconds(r) / 60) + offMinutes(dayKey(), off));
  const series = tempoSeries(progress);
  const changes = checkups.length > 1 ? compareCheckups(checkups[0].measures, checkups[checkups.length - 1].measures) : [];
  const earRows = (['intervals', 'chords', 'progressions', 'play'] as const).map(m => ({ m, s: summary(ear, m) })).filter(x => x.s.n > 0);
  const EAR_FR = { intervals: 'Intervalles', chords: 'Accords à l’oreille', progressions: 'Suites d’accords', play: 'Accords joués' };
  const th = theorySummary(theory);

  return (
    <Phone label="Progrès">
      <StatusBar />
      <div className="screen-body" style={{ gap: 14 }}>
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/pratiquer" />
            <div className="head-titles">
              <span className="kicker">Pratiquer</span>
              <h1 className="display" style={{ fontSize: 30 }}>PROGRÈS</h1>
            </div>
          </div>
        </div>

        <WeeksChart weeks={weeks} />

        <section className="card prog-card" aria-label="Tempos du coach">
          <span className="week-title">Tempos du coach</span>
          {series.length ? series.map(s => <TempoChart key={s.ex} ex={s.ex} points={s.points} />) : (
            <p className="help">Après chaque exercice du coach, dites s’il était facile, juste ou difficile : vos tempos s’afficheront ici, séance après séance.
              {' '}<button className="btn-link small inline" onClick={() => nav('/pratiquer/coach')}>Ouvrir le coach ›</button></p>
          )}
        </section>

        <section className="card prog-card" aria-label="Bilans du coach">
          <span className="week-title">Bilans du coach</span>
          {changes.length ? (
            <>
              <span className="help">Du {fmtDay(new Date(checkups[0].date))} au {fmtDay(new Date(checkups[checkups.length - 1].date))} · {checkups.length} bilans</span>
              <div className="prog-tiles">
                {changes.map(c => (
                  <div key={c.skill} className="prog-tile">
                    <span className="prog-tile-label">{c.label}</span>
                    <b className="mono">{c.from} → {c.to}</b>
                    <span className={'prog-tile-sub' + (c.better ? ' up' : '')}>{c.unit}{c.better ? ' · mieux' : ''}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="help">Le test du mois du coach mesure vos progrès : comparés au bilan de départ, ils s’afficheront ici.</p>}
        </section>

        {earRows.length > 0 && (
          <section className="card prog-card" aria-label="Oreille">
            <span className="week-title">Oreille</span>
            <div className="prog-tiles">
              {earRows.map(({ m, s }) => (
                <div key={m} className="prog-tile">
                  <span className="prog-tile-label">{EAR_FR[m]}</span>
                  <b className="mono">{s.rate} %</b>
                  <span className="prog-tile-sub">sur {s.n} essai{s.n > 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {th.n > 0 && (
          <section className="card prog-card" aria-label="Théorie">
            <span className="week-title">Théorie</span>
            <div className="prog-tiles">
              <div className="prog-tile">
                <span className="prog-tile-label">Réussite</span>
                <b className="mono">{th.rate} %</b>
                <span className="prog-tile-sub">sur {th.n} question{th.n > 1 ? 's' : ''}</span>
              </div>
              {th.weakest && (
                <div className="prog-tile">
                  <span className="prog-tile-label">À revoir</span>
                  <b className="prog-tile-text">{THEORY_KIND_FR[th.weakest]}</b>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
      <TabBar active={2} />
    </Phone>
  );
}

/** Minutes per week over twelve weeks: tap a bar to read it; a table for every value. */
function WeeksChart({ weeks }: { weeks: ReturnType<typeof weeklyMinutes> }) {
  const [sel, setSel] = useState(weeks.length - 1);
  const [table, setTable] = useState(false);
  const H = 112;
  const max = Math.max(60, ...weeks.map(w => w.min));
  const played = weeks.filter(w => !w.current && w.min > 0);
  const avg = played.length ? Math.round(played.reduce((t, w) => t + w.min, 0) / played.length) : 0;
  const s = weeks[sel];
  return (
    <section className="card week prog-card" aria-label="Pratique par semaine">
      <div className="week-head">
        <span className="week-title">Pratique par semaine</span>
        <span className="week-total">moyenne <b>{fmtHM(avg)}</b></span>
      </div>
      {table ? (
        <table className="prog-table">
          <thead><tr><th>Semaine du</th><th>Pratique</th></tr></thead>
          <tbody>{weeks.map((w, i) => <tr key={i}><td>{fmtDay(w.start)}{w.current ? ' (en cours)' : ''}</td><td className="mono">{fmtHM(w.min)}</td></tr>)}</tbody>
        </table>
      ) : (
        <>
          <div className="week-plot prog-weeks" style={{ height: H }}>
            {weeks.map((w, i) => (
              <button key={i} className={'week-col' + (i === sel ? ' sel' : '')} onClick={() => setSel(i)} aria-pressed={i === sel}
                aria-label={`Semaine du ${fmtDay(w.start)} : ${fmtHM(w.min)}`}>
                <span className={'week-bar' + (w.current ? ' today' : '')} style={{ height: w.min ? Math.max(4, (w.min / max) * H) : 0 }} />
              </button>
            ))}
          </div>
          <div className="week-axis prog-weeks">
            {weeks.map((w, i) => <span key={i} className={(w.current ? 'today' : '') + (i === sel ? ' sel' : '')}>{i % 3 === weeks.length % 3 || w.current ? (w.current ? 'Sem.' : fmtDay(w.start).replace('.', '')) : ''}</span>)}
          </div>
          <div className="week-foot" role="status">Semaine du {fmtDay(s.start)}{s.current ? ' (en cours)' : ''} · {fmtHM(s.min)}</div>
        </>
      )}
      <button className="btn-link small" onClick={() => setTable(!table)}>{table ? 'Voir le graphique' : 'Voir en tableau'}</button>
    </section>
  );
}

/** One exercise's tempo, session after session (a line); tap or slide to read a point. */
function TempoChart({ ex, points }: { ex: TempoEx; points: TempoPoint[] }) {
  const [sel, setSel] = useState(points.length - 1);
  const W = 300, H = 90, pad = 10;
  const lo = Math.min(...points.map(p => p.bpm)) - 4, hi = Math.max(...points.map(p => p.bpm)) + 4;
  const x = (i: number) => pad + (points.length > 1 ? (i / (points.length - 1)) * (W - 2 * pad) : (W - 2 * pad) / 2);
  const y = (b: number) => H - pad - ((b - lo) / (hi - lo)) * (H - 2 * pad);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.bpm).toFixed(1)}`).join(' ');
  const pickAt = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    points.forEach((_, i) => { if (Math.abs(x(i) - fx) < Math.abs(x(best) - fx)) best = i; });
    setSel(best);
  };
  const p = points[sel];
  const first = points[0].bpm, last = points[points.length - 1].bpm;
  return (
    <div className="prog-tempo">
      <div className="prog-tempo-head">
        <span>{EX_FR[ex]}</span>
        <span className="mono">{first} → <b>{last}</b> BPM{last > first ? ` (+${last - first})` : ''}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="prog-line" role="img" aria-label={`${EX_FR[ex]} : de ${first} à ${last} BPM en ${points.length - 1} séances`}
        onPointerDown={pickAt} onPointerMove={e => e.buttons && pickAt(e)}>
        <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} className="prog-base" />
        <path d={path} className="prog-path" />
        <line x1={x(sel)} x2={x(sel)} y1={pad / 2} y2={H - pad} className="prog-cross" />
        {points.map((q, i) => (i === sel || q.next) && <circle key={i} cx={x(i)} cy={y(q.bpm)} r={i === sel ? 5 : 4} className={'prog-dot' + (q.next ? ' next' : '')} />)}
      </svg>
      <span className="prog-read" role="status">{p.next ? `Prochaine séance : ${p.bpm} BPM` : `${fmtDay(dateOfDay(p.day))} · ${p.bpm} BPM${p.feel ? ` · ${FEEL[p.feel]}` : ''}`}</span>
    </div>
  );
}
