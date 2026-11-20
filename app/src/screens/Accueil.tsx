import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, StatusBar, TabBar } from '../components/Chrome';
import { SETTINGS, TILES, type Tile } from '../lib/data';
import { INITIAL_IDEAS } from '../lib/ideas';
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
  const metroSub = `${readStored('metro.bpm', 92)} BPM · ${readStored('metro.sig', '4/4')}`;
  const carnetSub = `${readStored('ideas', INITIAL_IDEAS).length} idées`;
  const tiles = TILES.filter(t => !removed.includes(t.id)).map(t =>
    t.id === 'metro' ? { ...t, sub: metroSub } : t.id === 'carnet' ? { ...t, sub: carnetSub } : t);

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

        <div className="home-widgets" style={{ gridTemplateColumns: SETTINGS.showStreak ? 'minmax(0,1fr) 112px' : 'minmax(0,1fr)' }}>
          <div role="button" tabIndex={0} className="card resume" onClick={() => nav('/pratiquer')}>
            <div className="resume-kicker"><span className="resume-dot" /><span>Reprendre</span></div>
            <div className="resume-title">Impro blues en La</div>
            <div className="resume-sub">Routine · étape 3/4 · 8 min</div>
            <div className="progress"><div style={{ width: '62%' }} /></div>
          </div>
          {SETTINGS.showStreak && (
            <div className="card streak">
              <span className="streak-num">12</span>
              <span className="streak-lbl">jours de pratique</span>
              <div className="streak-dots">{[0, 1, 2, 3, 4].map(i => <span key={i} className={i === 4 ? 'today' : ''} />)}</div>
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
      </div>

      <button className="fab" onClick={() => nav('/composer', { state: { record: true } })}><span>+</span>Idée</button>
      <TabBar active={0} />
    </Phone>
  );
}
