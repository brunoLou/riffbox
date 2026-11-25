import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, StatusBar, TabBar } from '../components/Chrome';
import { PedalTile } from '../components/PedalTile';
import { DEFAULT_LAYOUT, SETTINGS, TILES, type Slot, type Tile } from '../lib/data';
import { SECTION_IDEAS, cleanName, deleteSection, groupOf, groupSlots, moveToSection, newSection, placeNear, shiftSection, type Section } from '../lib/homeBoard';
import { doneSeconds, streak, useRoutine, routineMin, routineSteps } from '../lib/routine';
import { readStored, useStoredState } from '../lib/store';
import { subFor } from '../lib/tileSub';
import { buildBackup, saveBackup } from '../lib/backup';
import { backupReminder, daysAgo, markBackedUp, snoozeReminder } from '../lib/reminder';
import './Accueil.css';
import { useDialog } from '../lib/useDialog';
import { useUsedToday } from '../lib/usage';
import { preloadGoogle, syncNow, useDriveState } from '../lib/autoSync';

function todayLabel() {
  const s = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  const [sections, setSections] = useStoredState<Section[]>('home.sections', []);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropZone, setDropZone] = useState<string | null>(null);
  /** The catalog is open, adding to this compartment ('' : unsorted). */
  const [catalog, setCatalog] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  /** The pedal whose compartment is being chosen. */
  const [sorting, setSorting] = useState<string | null>(null);
  /** Creating a compartment (from the board, or while sorting a pedal). */
  const [naming, setNaming] = useState<string | null>(null);
  const used = useUsedToday();
  const dlgCatalog = useDialog(() => { setCatalog(null); setConfirmReset(false); });
  const dlgSort = useDialog(() => { setSorting(null); setNaming(null); });
  const lastTarget = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const hitRef = useRef<(x: number, y: number) => void>(() => {});
  const r = useRoutine();
  const showStreak = readStored(SETTINGS.showStreak.key, SETTINGS.showStreak.def);
  const st = streak(r);
  const step = routineSteps()[r.step];
  const left = Math.ceil((step.min * 60 - r.elapsed[r.step]) / 60);

  const byId = new Map(TILES.map(t => [t.id, t]));
  const slots = layout.filter(s => byId.has(s.id));
  const missing = TILES.filter(t => !slots.some(s => s.id === t.id));
  const groups = groupSlots(slots, sections);
  const hasSections = sections.length > 0;

  // Drag from the grip: the tile follows the finger by taking the place of the tile underneath, or
  // goes into the compartment under the finger.
  const onGrip = (id: string) => (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    lastTarget.current = null;
    setDragId(id);
  };
  const hit = (x: number, y: number) => {
    if (!dragId) return;
    const under = document.elementsFromPoint(x, y) as HTMLElement[];
    const tile = under.map(x => x.closest?.('[data-tile]') as HTMLElement | null).find(x => x && x.dataset.tile !== dragId);
    const zone = under.map(x => x.closest?.('[data-zone]') as HTMLElement | null).find(Boolean);
    const target = tile ? 'tile:' + tile.dataset.tile : zone ? 'zone:' + zone.dataset.zone : null;
    setDropZone(zone?.dataset.zone ?? null);
    if (!target || target === lastTarget.current) return;
    lastTarget.current = target;
    if (tile) {
      const to = tile.dataset.tile!;
      setLayout(all => placeNear(all, dragId, to, all.findIndex(s => s.id === dragId) < all.findIndex(s => s.id === to), sections));
    } else {
      const sec = zone!.dataset.zone!;
      setLayout(all => { const it = all.find(s => s.id === dragId); return it && groupOf(it, sections) !== sec ? moveToSection(all, dragId, sec) : all; });
    }
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragId) return;
    pointer.current = { x: e.clientX, y: e.clientY };
    hit(e.clientX, e.clientY);
  };
  hitRef.current = hit;
  // Near the top or bottom edge, the board scrolls by itself, so a pedal can reach any compartment.
  useEffect(() => {
    if (!dragId) return;
    let raf = 0;
    const tick = () => {
      const el = scrollRef.current, p = pointer.current;
      if (el && p) {
        const r = el.getBoundingClientRect();
        const top = r.top + 70, bottom = Math.min(r.bottom, window.innerHeight) - 110;
        const d = p.y < top ? p.y - top : p.y > bottom ? p.y - bottom : 0;
        if (d) {
          const before = el.scrollTop;
          el.scrollTop += Math.max(-16, Math.min(16, d / 4));
          if (el.scrollTop !== before) hitRef.current(p.x, p.y);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dragId]);
  const endDrag = () => { pointer.current = null; setDragId(null); setDropZone(null); lastTarget.current = null; };

  // Keyboard: the arrows move a pedal through the board as shown, from one compartment to the next.
  const onGripKey = (id: string) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const d = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
    if (!d) return;
    e.preventDefault();
    // Each pedal is a stop, and so is each empty compartment.
    const stops = groups.flatMap(g => (g.slots.length ? g.slots.map(x => ({ id: x.id, g: g.id })) : [{ id: '', g: g.id }]));
    const i = stops.findIndex(x => x.id === id), to = stops[i + d];
    if (i < 0 || !to) return;
    if (!to.id) setLayout(all => moveToSection(all, id, to.g));
    // Into the next compartment, it comes first (going down) or last (going up).
    else setLayout(all => placeNear(all, id, to.id, to.g !== stops[i].g ? d < 0 : d > 0, sections));
    requestAnimationFrame(() => (document.querySelector(`[data-grip="${id}"]`) as HTMLElement | null)?.focus());
  };

  const add = (t: Tile) => setLayout(all => [...all, { id: t.id, wide: !!t.wide, ...(catalog ? { sec: catalog } : {}) }]);
  const resetLayout = () => { setLayout(DEFAULT_LAYOUT); setSections([]); setConfirmReset(false); setCatalog(null); };

  const createSection = (name: string, putIn?: string) => {
    if (!cleanName(name)) return;
    const s = newSection(name);
    setSections(all => [...all, s]);
    if (putIn) setLayout(all => moveToSection(all, putIn, s.id));
    setNaming(null);
    setSorting(null);
  };
  const renameSection = (id: string, name: string) => setSections(all => all.map(s => (s.id === id ? { ...s, name: name.slice(0, 40) } : s)));
  const removeSection = (id: string) => {
    const r = deleteSection(layout, sections, id);
    setLayout(r.layout);
    setSections(r.sections);
  };
  const toggleFold = (id: string) => setSections(all => all.map(s => (s.id === id ? { ...s, folded: !s.folded } : s)));
  const finishEdit = () => {
    // A compartment left without a name gets one back.
    setSections(all => all.some(s => !cleanName(s.name)) ? all.map((s, i) => (cleanName(s.name) ? { ...s, name: cleanName(s.name) } : { ...s, name: `Compartiment ${i + 1}` })) : all);
  };

  const tile = (s: Slot) => {
    const t = { ...byId.get(s.id)!, sub: subFor(byId.get(s.id)!, r), on: used.has(s.id) };
    return (
      <PedalTile key={s.id} t={t} wide={s.wide} edit={edit} lifted={dragId === s.id}
        onOpen={() => nav(s.id === 'routine' ? '/pratiquer/routine' : t.to)}
        onRemove={() => setLayout(all => all.filter(x => x.id !== s.id))}
        onResize={() => setLayout(all => all.map(x => (x.id === s.id ? { ...x, wide: !x.wide } : x)))}
        onSort={() => setSorting(s.id)}
        onGrip={onGrip(s.id)} onGripKey={onGripKey(s.id)} />
    );
  };
  const usedNames = new Set(sections.map(s => cleanName(s.name).toLowerCase()));
  const ideas = SECTION_IDEAS.filter(n => !usedNames.has(n.toLowerCase())).slice(0, 4);
  const sortingTile = sorting ? byId.get(sorting) : undefined;
  const sortingSec = sorting ? groupOf(layout.find(s => s.id === sorting) ?? { id: '', wide: false }, sections) : '';

  return (
    <Phone label="01 Accueil">
      <StatusBar />
      <div className="home-scroll" ref={scrollRef}>
        <div className="head">
          <div className="head-titles">
            <span className="kicker">{todayLabel()}</span>
            <h1 className="display" style={{ fontSize: 32 }}>MON PEDALBOARD</h1>
          </div>
          <button className={'edit-btn' + (edit ? ' on' : '')} onClick={() => { if (edit) finishEdit(); setEdit(!edit); setDragId(null); setNaming(null); }}>{edit ? 'Terminé' : 'Modifier'}</button>
        </div>

        {!edit && <BackupReminder />}
        {!edit && <DriveChip />}

        {edit ? (
          <p className="edit-hint">Glissez une pédale par sa poignée ⠿ pour la déplacer, y compris d’un compartiment à l’autre. ▤ la range dans un compartiment, ↔ change sa taille, − la retire.</p>
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

        <div className="board-groups" onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
          {groups.map((g, gi) => {
            // The unsorted pedals have no heading; once there are compartments, they get one while editing.
            if (!g.name && g.id === '' && !g.slots.length && !(edit && hasSections) && slots.length) return null;
            const named = g.id !== '';
            const sec = sections.find(s => s.id === g.id);
            const folded = named && g.folded && !edit;
            return (
              <section key={g.id || 'unsorted'} className={'board-group' + (folded ? ' folded' : '')} aria-label={named ? `Compartiment ${g.name}` : 'Pédales'}>
                {named && (edit ? (
                  <div className="group-head">
                    <input className="group-name-input" value={sec!.name} aria-label="Nom du compartiment" maxLength={40}
                      placeholder="Nom du compartiment" onChange={e => renameSection(g.id, e.target.value)} />
                    <button className="group-btn" aria-label={`Monter ${g.name}`} disabled={gi === 1} onClick={() => setSections(all => shiftSection(all, g.id, -1))}>↑</button>
                    <button className="group-btn" aria-label={`Descendre ${g.name}`} disabled={gi === groups.length - 1} onClick={() => setSections(all => shiftSection(all, g.id, 1))}>↓</button>
                    <button className="group-btn danger" aria-label={`Supprimer le compartiment ${g.name}`} onClick={() => removeSection(g.id)}>✕</button>
                  </div>
                ) : (
                  <div className="group-head">
                    <button className="group-toggle" aria-expanded={!folded} onClick={() => toggleFold(g.id)}>
                      <span className="group-caret" aria-hidden>▾</span>
                      <span className="group-name">{g.name}</span>
                      <span className="group-rule" aria-hidden />
                      <span className="group-count">{g.slots.length} pédale{g.slots.length > 1 ? 's' : ''}</span>
                    </button>
                  </div>
                ))}
                {!named && edit && hasSections && (
                  <div className="group-head"><span className="group-name" style={{ color: 'var(--muted-3)' }}>Non classées</span><span className="group-rule" aria-hidden /></div>
                )}
                {!folded && (
                  <div className={'pedal-grid' + (dragId ? ' dragging' : '') + (dragId && dropZone === g.id ? ' drop-on' : '')} data-zone={g.id}>
                    {g.slots.map(tile)}
                    {!slots.length && !named && !edit && <div className="empty-board">Votre pedalboard est vide. Touchez « Modifier » pour ajouter des pédales.</div>}
                    {named && !g.slots.length && <div className="group-empty">{edit ? 'Glissez une pédale ici, ou touchez ▤ Ranger sur une pédale.' : 'Compartiment vide : touchez « Modifier » pour y ranger des pédales.'}</div>}
                    {edit && (named
                      ? <button className="add-pedal small" onClick={() => setCatalog(g.id)}>+ Ajouter une pédale ici</button>
                      : <button className="add-pedal" onClick={() => setCatalog('')}>+ Ajouter une pédale</button>)}
                  </div>
                )}
              </section>
            );
          })}
          {edit && (naming === '' ? (
            <NewSectionForm ideas={ideas} onCreate={n => createSection(n)} onCancel={() => setNaming(null)} />
          ) : (
            <button className="add-section" onClick={() => setNaming('')}>+ Nouveau compartiment</button>
          ))}
        </div>
        {!edit && slots.length > 0 && (
          <p className="led-legend"><span className="led on" aria-hidden />Voyant allumé : outil utilisé aujourd’hui</p>
        )}

        <button className="settings-link" onClick={() => nav('/reglages')}><span>Réglages et données</span><span>›</span></button>
      </div>

      {catalog !== null && (
        <div className="sheet-backdrop" onClick={() => { setCatalog(null); setConfirmReset(false); }}>
          <div className="set-sheet catalog" ref={dlgCatalog} role="dialog" aria-label="Ajouter une pédale" onClick={e => e.stopPropagation()}>
            <div className="set-sheet-head">
              <span className="kicker sheet-kicker">Ajouter une pédale{catalog ? ` · ${sections.find(s => s.id === catalog)?.name ?? ''}` : ''}</span>
              <button className="player-close" onClick={() => setCatalog(null)} aria-label="Fermer">✕</button>
            </div>
            <div className="catalog-list pedal-grid">
              {missing.map(t => (
                <PedalTile key={t.id} t={{ ...t, sub: subFor(t, r), on: used.has(t.id) }} label={`Ajouter ${t.name}`} onOpen={() => add(t)} />
              ))}
              {!missing.length && <p className="sheet-empty" style={{ gridColumn: 'span 2' }}>Toutes les pédales sont déjà sur l’accueil.</p>}
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

      {sortingTile && (
        <div className="sheet-backdrop" onClick={() => { setSorting(null); setNaming(null); }}>
          <div className="set-sheet" ref={dlgSort} role="dialog" aria-label={`Ranger ${sortingTile.name}`} onClick={e => e.stopPropagation()}>
            <div className="set-sheet-head">
              <span className="kicker sheet-kicker">Ranger {sortingTile.name}</span>
              <button className="player-close" onClick={() => { setSorting(null); setNaming(null); }} aria-label="Fermer">✕</button>
            </div>
            <div className="sort-list">
              {[{ id: '', name: 'Non classées' }, ...sections].map(s => (
                <button key={s.id || 'none'} className={'sort-row' + (sortingSec === s.id ? ' on' : '')} aria-pressed={sortingSec === s.id}
                  onClick={() => { setLayout(all => moveToSection(all, sorting!, s.id)); setSorting(null); }}>
                  <span>{s.name || 'Sans nom'}</span>{sortingSec === s.id && <span aria-hidden>✓</span>}
                </button>
              ))}
            </div>
            {naming === sorting
              ? <NewSectionForm ideas={ideas} onCreate={n => createSection(n, sorting!)} onCancel={() => setNaming(null)} />
              : <button className="add-section" onClick={() => setNaming(sorting)}>+ Nouveau compartiment</button>}
          </div>
        </div>
      )}
      <TabBar active={0} />
    </Phone>
  );
}

/** Naming a new compartment: the player types it, or picks a suggestion. */
function NewSectionForm({ ideas, onCreate, onCancel }: { ideas: string[]; onCreate: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  return (
    <form className="section-form" onSubmit={e => { e.preventDefault(); onCreate(name); }}>
      <span className="kicker">Nouveau compartiment</span>
      <div className="section-form-row">
        <input className="group-name-input" autoFocus value={name} maxLength={40} aria-label="Nom du nouveau compartiment"
          placeholder="Ex. : Outils, Entraînement…" onChange={e => setName(e.target.value)} />
        <button type="submit" className="group-btn" style={{ width: 'auto', padding: '0 14px' }} disabled={!cleanName(name)}>Créer</button>
      </div>
      {ideas.length > 0 && (
        <div className="section-ideas">
          {ideas.map(n => <button type="button" key={n} className="chip" onClick={() => onCreate(n)}>{n}</button>)}
        </div>
      )}
      <button type="button" className="btn-outline" onClick={onCancel}>Annuler</button>
    </form>
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

/** When Google asks to sign in again (it cannot happen without a tap), one tap here resumes the sync. */
function DriveChip() {
  const st = useDriveState();
  const show = st.connected && st.status === 'needsTap';
  useEffect(() => { if (show) preloadGoogle(); }, [show]);
  if (!show) return null;
  return <button className="drive-chip" onClick={() => void syncNow(true)}>↻ Synchroniser avec Google Drive</button>;
}
