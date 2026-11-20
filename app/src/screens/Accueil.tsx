import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, StatusBar, TabBar } from '../components/Chrome';
import { SETTINGS, TILES, type Tile } from '../lib/data';
import { readGrids } from '../lib/grids';
import { INITIAL_IDEAS } from '../lib/ideas';
import { ROUTINE, ROUTINE_MIN, doneSeconds, streak, useRoutine } from '../lib/routine';
import { INITIAL_SETLISTS, titlesLabel } from '../lib/setlists';
import { readStored, useStoredState } from '../lib/store';
import './Accueil.css';

function todayLabel() {
  const s = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Knob({ deg }: { deg: number }) {
  return <div className="knob" style={{ transform: `rotate(${deg}deg)` }}><span /></div>;
}

function PedalTile({ t, edit, onOpen, onRemove }: { t: Tile; edit: boolean; onOpen: () => void; onRemove: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={'pedal' + (edit ? ' editing' : '')}
      style={{ gridColumn: t.wide ? 'span 2' : 'span 1', background: t.bg, color: t.fg }}
      onClick={() => !edit && onOpen()}
      onKeyDown={e => { if (!edit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen(); } }}
    >
      <div className="pedal-top">
        <span className={'led pedal-led' + (t.on ? ' on' : '')} />
        <div className="pedal-knobs"><Knob deg={t.a} /><Knob deg={t.b} /></div>
      </div>
      <div className="pedal-text">
        <span className="pedal-name">{t.name}</span>
        <span className="pedal-sub">{t.sub}</span>
      </div>
      <div className="footswitch" />
      {edit && (
        <button className="pedal-remove" aria-label={`Retirer ${t.name}`} onClick={e => { e.stopPropagation(); onRemove(); }}>−</button>
      )}
    </div>
  );
}

export default function Accueil() {
  const nav = useNavigate();
  const [edit, setEdit] = useState(false);
  const [removed, setRemoved] = useStoredState<string[]>('home.removed', []);
  const r = useRoutine();
  const showStreak = readStored(SETTINGS.showStreak.key, SETTINGS.showStreak.def);
  const st = streak(r);
  const metroSub = `${readStored('metro.bpm', 92)} BPM · ${readStored('metro.sig', '4/4')}`;
  const nGrids = readGrids().length;
  // Same count as the notebook header: ideas and grids.
  const nIdeas = readStored('ideas', INITIAL_IDEAS).length + nGrids;
  const carnetSub = `${nIdeas} idée${nIdeas > 1 ? 's' : ''}`;
  const nextSet = [...readStored('setlists', INITIAL_SETLISTS)].filter(s => s.date >= Date.now()).sort((a, b) => a.date - b.date)[0];
  const setsSub = nextSet ? `${nextSet.name} · ${titlesLabel(nextSet.songIds.length)}` : 'Aucun concert prévu';
  const tiles = TILES.filter(t => !removed.includes(t.id)).map(t =>
    t.id === 'metro' ? { ...t, sub: metroSub }
      : t.id === 'carnet' ? { ...t, sub: carnetSub }
        : t.id === 'setlists' ? { ...t, sub: setsSub }
        : t.id === 'grilles' ? { ...t, sub: `${nGrids} grille${nGrids > 1 ? 's' : ''}` }
          : t.id === 'routine' ? { ...t, sub: `${Math.floor(doneSeconds(r) / 60)}/${ROUTINE_MIN} min aujourd’hui`, to: '/pratiquer/routine' } : t);
  const step = ROUTINE[r.step];
  const left = Math.ceil((step.min * 60 - r.elapsed[r.step]) / 60);

  return (
    <Phone label="01 Accueil">
      <StatusBar />
      <div className="home-scroll">
        <div className="head">
          <div className="head-titles">
            <span className="kicker">{todayLabel()}</span>
            <span className="display" style={{ fontSize: 32 }}>MON PEDALBOARD</span>
          </div>
          <button className={'edit-btn' + (edit ? ' on' : '')} onClick={() => setEdit(!edit)}>{edit ? 'Terminé' : 'Modifier'}</button>
        </div>

        <div className="home-widgets" style={{ gridTemplateColumns: showStreak ? 'minmax(0,1fr) 112px' : 'minmax(0,1fr)' }}>
          <div role="button" tabIndex={0} className="card resume" onClick={() => nav('/pratiquer/routine')}
            onKeyDown={e => { if (e.key === 'Enter') nav('/pratiquer/routine'); }}>
            <div className="resume-kicker"><span className="resume-dot" /><span>{r.done ? 'Routine faite' : r.running ? 'En cours' : 'Reprendre'}</span></div>
            <div className="resume-title">{r.done ? 'Routine du jour terminée' : step.short}</div>
            <div className="resume-sub">{r.done ? `${ROUTINE_MIN} min de pratique` : `Routine · étape ${r.step + 1}/${ROUTINE.length} · ${left} min`}</div>
            <div className="progress"><div style={{ width: `${(doneSeconds(r) / (ROUTINE_MIN * 60)) * 100}%` }} /></div>
          </div>
          {showStreak && (
            <div className="card streak" role="button" tabIndex={0} onClick={() => nav('/pratiquer')} aria-label={`${st.days} jours de pratique d’affilée`}>
              <span className="streak-num">{st.days}</span>
              <span className="streak-lbl">{st.days > 1 ? 'jours' : 'jour'} de pratique</span>
              <div className="streak-dots">{st.recent.map((on, i) => <span key={i} className={(on ? 'on' : '') + (i === 4 ? ' today' : '')} />)}</div>
            </div>
          )}
        </div>

        <div className="pedal-grid">
          {tiles.map(t => (
            <PedalTile key={t.id} t={t} edit={edit} onOpen={() => nav(t.to)} onRemove={() => setRemoved([...removed, t.id])} />
          ))}
          {edit && (
            <button className="add-pedal" onClick={() => setRemoved(removed.slice(0, -1))} disabled={!removed.length}>
              + Ajouter une pédale
            </button>
          )}
        </div>

        <button className="settings-link" onClick={() => nav('/reglages')}><span>Réglages et données</span><span>›</span></button>
      </div>

      <button className="fab" onClick={() => nav('/composer', { state: { record: true } })}><span>+</span>Idée</button>
      <TabBar active={0} />
    </Phone>
  );
}
