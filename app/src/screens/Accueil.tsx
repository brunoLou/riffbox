import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, StatusBar, TabBar } from '../components/Chrome';
import { PedalTile } from '../components/PedalTile';
import { DEFAULT_LAYOUT, SETTINGS, TILES, type Slot, type Tile } from '../lib/data';
import { readGrids } from '../lib/grids';
import { KEY_FR } from '../lib/music';
import { scaleDef } from '../lib/scales';
import { INITIAL_IDEAS } from '../lib/ideas';
import { doneSeconds, streak, useRoutine, type RoutineState, routineMin, routineSteps } from '../lib/routine';
import { INITIAL_SETLISTS, readSongs, titlesLabel } from '../lib/setlists';
import { readStored, useStoredState } from '../lib/store';
import { currentTuning } from '../lib/tunings';
import { readRange, noteFr } from '../lib/voice';
import { buildBackup, saveBackup } from '../lib/backup';
import { backupReminder, daysAgo, markBackedUp, snoozeReminder } from '../lib/reminder';
import './Accueil.css';
import { useDialog } from '../lib/useDialog';

function todayLabel() {
  const s = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Live subtitle for tiles that summarise their tool. */
function subFor(t: Tile, r: RoutineState): string {
  const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? 's' : ''}`;
  switch (t.id) {
    case 'tuner': return `Chromatique · ${currentTuning().label}`;
    case 'metro': return `${readStored('metro.bpm', 92)} BPM · ${readStored('metro.sig', '4/4')}`;
    case 'carnet': return plural(readStored('ideas', INITIAL_IDEAS).length + readGrids().length, 'idée');
    case 'grilles': return plural(readGrids().length, 'grille');
    case 'manche': return `${scaleDef(readStored('scale.id', 'pmin')).chip} · ${KEY_FR[readStored('scale.key', 9)]}`;
    case 'routine': return `${Math.floor(doneSeconds(r) / 60)}/${routineMin()} min aujourd’hui`;
    case 'morceaux': return plural(readSongs().length, 'titre');
    case 'tonalite': { const v = readRange(); return v.measured ? `${noteFr(v.low)} – ${noteFr(v.high)}` : t.sub; }
    case 'setlists': {
      const next = [...readStored('setlists', INITIAL_SETLISTS)].filter(s => s.date >= Date.now()).sort((a, b) => a.date - b.date)[0];
      return next ? `${next.name} · ${titlesLabel(next.songIds.length)}` : 'Aucun concert prévu';
    }
  }
  return t.sub;
}

/** First launch after the update: the old "removed tiles" list becomes the layout. */
function initialLayout(): Slot[] {
  const removed = readStored<string[]>('home.removed', []);
  return DEFAULT_LAYOUT.filter(s => !removed.includes(s.id));
}

export default function Accueil() {
  const nav = useNavigate();
  const [edit, setEdit] = useState(false);
  const [layout, setLayout] = useStoredState<Slot[]>('home.layout', initialLayout());
  const [dragId, setDragId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const dlgCatalog = useDialog(() => { setCatalog(false); setConfirmReset(false); });
  const lastTarget = useRef<string | null>(null);
  const r = useRoutine();
  const showStreak = readStored(SETTINGS.showStreak.key, SETTINGS.showStreak.def);
  const st = streak(r);
  const step = routineSteps()[r.step];
  const left = Math.ceil((step.min * 60 - r.elapsed[r.step]) / 60);

  const byId = new Map(TILES.map(t => [t.id, t]));
  const slots = layout.filter(s => byId.has(s.id));
  const missing = TILES.filter(t => !slots.some(s => s.id === t.id));

  const move = (id: string, to: number) => setLayout(all => {
    const from = all.findIndex(s => s.id === id);
    if (from < 0 || to < 0 || to >= all.length || from === to) return all;
    const next = all.slice();
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    return next;
  });

  // Drag from the grip: the tile follows the finger by taking the place of the tile underneath.
  const onGrip = (id: string) => (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    lastTarget.current = null;
    setDragId(id);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragId) return;
    const el = document.elementsFromPoint(e.clientX, e.clientY)
      .map(x => (x as HTMLElement).closest?.('[data-tile]') as HTMLElement | null)
      .find(x => x && x.dataset.tile !== dragId);
    const target = el?.dataset.tile ?? null;
    if (!target || target === lastTarget.current) return;
    lastTarget.current = target;
    move(dragId, layout.findIndex(s => s.id === target));
  };
  const endDrag = () => { setDragId(null); lastTarget.current = null; };

  const onGripKey = (id: string) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const d = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
    if (!d) return;
    e.preventDefault();
    move(id, layout.findIndex(s => s.id === id) + d);
    requestAnimationFrame(() => (document.querySelector(`[data-grip="${id}"]`) as HTMLElement | null)?.focus());
  };

  const add = (t: Tile) => setLayout(all => [...all, { id: t.id, wide: !!t.wide }]);
  const resetLayout = () => { setLayout(DEFAULT_LAYOUT); setConfirmReset(false); setCatalog(false); };

  return (
    <Phone label="01 Accueil">
      <StatusBar />
      <div className="home-scroll">
        <div className="head">
          <div className="head-titles">
            <span className="kicker">{todayLabel()}</span>
            <h1 className="display" style={{ fontSize: 32 }}>MON PEDALBOARD</h1>
          </div>
          <button className={'edit-btn' + (edit ? ' on' : '')} onClick={() => { setEdit(!edit); setDragId(null); }}>{edit ? 'Terminé' : 'Modifier'}</button>
        </div>

        {!edit && <BackupReminder />}

        {edit ? (
          <p className="edit-hint">Glissez une pédale par sa poignée ⠿ pour la déplacer. ↔ change sa taille, − la retire.</p>
        ) : (
          <div className="home-widgets" style={{ gridTemplateColumns: showStreak ? 'minmax(0,1fr) 112px' : 'minmax(0,1fr)' }}>
            <div role="button" tabIndex={0} className="card resume" onClick={() => nav('/pratiquer/routine')}
              onKeyDown={e => { if (e.key === 'Enter') nav('/pratiquer/routine'); }}>
              <div className="resume-kicker"><span className="resume-dot" /><span>{r.done ? 'Routine faite' : r.running ? 'En cours' : 'Reprendre'}</span></div>
              <div className="resume-title">{r.done ? 'Routine du jour terminée' : step.short}</div>
              <div className="resume-sub">{r.done ? `${routineMin()} min de pratique` : `Routine · étape ${r.step + 1}/${routineSteps().length} · ${left} min`}</div>
              <div className="progress"><div style={{ width: `${(doneSeconds(r) / (routineMin() * 60)) * 100}%` }} /></div>
            </div>
            {showStreak && (
              <div className="card streak" role="button" tabIndex={0} onClick={() => nav('/pratiquer')} aria-label={`${st.days} jours de pratique d’affilée`}>
                <span className="streak-num">{st.days}</span>
                <span className="streak-lbl">{st.days > 1 ? 'jours' : 'jour'} de pratique</span>
                <div className="streak-dots">{st.recent.map((on, i) => <span key={i} className={(on ? 'on' : '') + (i === 4 ? ' today' : '')} />)}</div>
              </div>
            )}
          </div>
        )}

        <div className={'pedal-grid' + (dragId ? ' dragging' : '')} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
          {slots.map(s => {
            const t = { ...byId.get(s.id)!, sub: subFor(byId.get(s.id)!, r) };
            return (
              <PedalTile key={s.id} t={t} wide={s.wide} edit={edit} lifted={dragId === s.id}
                onOpen={() => nav(s.id === 'routine' ? '/pratiquer/routine' : t.to)}
                onRemove={() => setLayout(all => all.filter(x => x.id !== s.id))}
                onResize={() => setLayout(all => all.map(x => (x.id === s.id ? { ...x, wide: !x.wide } : x)))}
                onGrip={onGrip(s.id)} onGripKey={onGripKey(s.id)} />
            );
          })}
          {!slots.length && !edit && <div className="empty-board">Votre pedalboard est vide. Touchez « Modifier » pour ajouter des pédales.</div>}
          {edit && (
            <button className="add-pedal" onClick={() => setCatalog(true)}>+ Ajouter une pédale</button>
          )}
        </div>

        <button className="settings-link" onClick={() => nav('/reglages')}><span>Réglages et données</span><span>›</span></button>
      </div>


      {catalog && (
        <div className="sheet-backdrop" onClick={() => { setCatalog(false); setConfirmReset(false); }}>
          <div className="set-sheet catalog" ref={dlgCatalog} role="dialog" aria-label="Ajouter une pédale" onClick={e => e.stopPropagation()}>
            <div className="set-sheet-head">
              <span className="kicker sheet-kicker">Ajouter une pédale</span>
              <button className="player-close" onClick={() => setCatalog(false)} aria-label="Fermer">✕</button>
            </div>
            <div className="catalog-list">
              {missing.map(t => (
                <button key={t.id} className="pick-row" onClick={() => add(t)}>
                  <span className="cat-swatch" style={{ background: t.bg }}><span className={'led' + (t.on ? ' on' : '')} /></span>
                  <div className="song-text">
                    <span className="song-title">{t.name}</span>
                    <span className="song-meta">{t.sub}</span>
                  </div>
                  <span className="pick-plus">+</span>
                </button>
              ))}
              {!missing.length && <p className="sheet-empty">Toutes les pédales sont déjà sur l’accueil.</p>}
            </div>
            {confirmReset ? (
              <div className="confirm-row">
                <button className="btn-outline" onClick={() => setConfirmReset(false)}>Annuler</button>
                <button className="btn-danger" onClick={resetLayout}>Rétablir</button>
              </div>
            ) : (
              <button className="btn-outline" onClick={() => setConfirmReset(true)}>Rétablir l’accueil d’origine…</button>
            )}
          </div>
        </div>
      )}
      <TabBar active={0} />
    </Phone>
  );
}

/** Suggests a backup when the player's own content has not been exported for a while. */
function BackupReminder() {
  const [due, setDue] = useState(() => backupReminder());
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  if (!due && state !== 'done') return null;

  const save = async () => {
    setState('busy');
    try {
      const b = await buildBackup();
      const how = await saveBackup(b);
      if (how === 'cancelled') { setState('idle'); return; }
      markBackedUp(b.exportedAt);
      setState('done');
      setDue(null);
      window.setTimeout(() => setState('idle'), 4000);
    } catch { setState('error'); }
  };

  if (state === 'done') return <p className="backup-nudge-done" role="status">Sauvegarde faite. Gardez le fichier hors du téléphone.</p>;
  return (
    <div className="backup-nudge" role="region" aria-label="Rappel de sauvegarde">
      <div className="backup-nudge-text">
        <span className="backup-nudge-title">Pensez à sauvegarder</span>
        <span className="backup-nudge-sub">
          {due!.never ? 'Aucune sauvegarde pour l’instant' : `Dernière sauvegarde ${daysAgo(due!.days)}`} : vos idées et vos morceaux ne sont que sur ce téléphone.
        </span>
        {state === 'error' && <span className="backup-nudge-sub error">L’export a échoué. Réessayez depuis Réglages.</span>}
      </div>
      <div className="backup-nudge-btns">
        <button className="backup-nudge-save" disabled={state === 'busy'} onClick={() => void save()}>{state === 'busy' ? 'Préparation…' : 'Sauvegarder'}</button>
        <button className="backup-nudge-later" onClick={() => { snoozeReminder(); setDue(null); }}>Plus tard</button>
      </div>
    </div>
  );
}
