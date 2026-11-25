import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import {
  DEFAULT_GAP, GAPS, allSongs, checklistOf, fmtClock, hasLyrics, fmtDur, fmtMin, nextSet, setDateLabel, setDuration, setTimeline, songById, songMeta,
  sortSets, titlesLabel, toLocalInput, type CheckItem, type Setlist,
} from '../lib/setlists';
import { useSetlists, useSongs } from '../lib/hooks';
import { SceneTabs } from './Morceaux';
import { setlistPdf, sharePdf } from '../lib/songbook';
import './Setlists.css';


/* ---------- 08a · Liste ---------- */

export function SetlistsScreen() {
  const nav = useNavigate();
  const { setId: openSet } = useParams();
  const [sets, setSets] = useSetlists();
  const sorted = sortSets(sets);
  const nextId = nextSet(sets)?.id;

  const create = () => {
    const id = 'set' + Date.now();
    const n = sets.filter(s => s.name.startsWith('Nouvelle setlist')).length + 1;
    setSets([...sets, { id, name: n > 1 ? `Nouvelle setlist ${n}` : 'Nouvelle setlist', songIds: [] }]);
    nav(`/scene/${id}`, { state: { edit: true } });
  };

  return (
    <Phone label="08a Setlists">
      <StatusBar />
      <div className="sets-scroll">
        <div className="head">
          <div className="head-titles">
            <span className="kicker">Live</span>
            <h1 className="display" style={{ fontSize: 30 }}>SETLISTS</h1>
          </div>
          <span className="sets-count mono">{sets.length} sets</span>
        </div>
        <SceneTabs active={0} />

        {sorted.map(s => {
          const next = s.id === nextId;
          return (
            <button key={s.id} className={'set-card' + (next ? ' next' : '') + (s.id === openSet ? ' sel' : '')} aria-current={s.id === openSet ? 'true' : undefined} onClick={() => nav(`/scene/${s.id}`)}>
              <div className="set-card-top">
                <span className="set-date mono">{s.date !== undefined ? setDateLabel(s) : ''}</span>
                {next && <span className="set-next"><span />Prochain</span>}
              </div>
              <span className="set-name">{s.name}</span>
              <span className="set-sub">{titlesLabel(s.songIds.length)} · {fmtMin(setDuration(s))}</span>
              <div className="set-preview">
                {s.songIds.slice(0, 3).map((id, i) => <span key={id}>{i + 1}. {songById(id)?.title}</span>)}
                {s.songIds.length > 3 && <span className="more">+{s.songIds.length - 3}</span>}
              </div>
              <span className="set-arrow">›</span>
            </button>
          );
        })}
      </div>
      <button className="cta" onClick={create}>+ Nouvelle setlist</button>
      <TabBar active={3} />
    </Phone>
  );
}

/* ---------- 08b · Détail ---------- */

export function SetlistDetail() {
  const { setId } = useParams();
  const nav = useNavigate();
  const [sets, setSets] = useSetlists();
  const [, setSongs] = useSongs();
  const set = sets.find(s => s.id === setId);
  const loc = useLocation();
  const [edit, setEdit] = useState(() => !!(loc.state as { edit?: boolean } | null)?.edit);
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!set) return <Navigate to="/scene" replace />;

  const update = (fn: (s: Setlist) => Setlist) => setSets(all => all.map(s => (s.id === set.id ? fn(s) : s)));
  const move = (i: number, d: -1 | 1) => update(s => {
    const ids = [...s.songIds]; const j = i + d;
    if (j < 0 || j >= ids.length) return s;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    return { ...s, songIds: ids };
  });
  const remove = (i: number) => update(s => ({ ...s, songIds: s.songIds.filter((_, k) => k !== i) }));
  const add = (id: string) => update(s => ({ ...s, songIds: [...s.songIds, id] }));
  const createSong = () => {
    const id = 'song' + Date.now();
    setSongs(all => [...all, { id, title: 'Nouveau morceau', key: 9, bpm: 90, feel: 'shuffle', capo: 0, duration: 210, chordpro: '' }]);
    nav(`/scene/morceau/${id}`, { state: { fresh: true, addToSet: set.id } });
  };
  const available = allSongs().filter(s => !set.songIds.includes(s.id));
  /** Deletes the setlist (its songs stay in the library). */
  const deleteSet = () => { setSets(all => all.filter(s => s.id !== set.id)); nav('/scene', { replace: true }); };
  const setDate = (v: string) => update(s => {
    const t = v ? new Date(v).getTime() : NaN;
    if (Number.isNaN(t)) { const { date: _, ...rest } = s; return rest; }
    return { ...s, date: t };
  });
  const gap = set.gap ?? DEFAULT_GAP;
  const songs = set.songIds.map(id => songById(id));
  const timeline = setTimeline(songs.map(x => x?.duration ?? 0), gap);
  const setMemo = (id: string, text: string) => update(s => {
    const memos = { ...(s.memos ?? {}) };
    if (text.trim()) memos[id] = text.slice(0, 160); else delete memos[id];
    return { ...s, memos };
  });
  const setChecklist = (fn: (c: CheckItem[]) => CheckItem[]) => update(s => ({ ...s, checklist: fn(checklistOf(s)) }));
  const fmtHMs = (sec: number) => { const m = Math.round(sec / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`; };
  const addDate = () => { const d = new Date(Date.now() + 7 * 86400000); d.setHours(21, 0, 0, 0); update(s => ({ ...s, date: d.getTime() })); };

  return (
    <Phone label="08b Setlist">
      <StatusBar />
      <div className="sets-scroll">
        <h1 className="sr-only">Setlist : {set.name}</h1>
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/scene" />
            <div className="head-titles">
              <span className="kicker">Setlist</span>
              {edit
                ? <input className="set-title-input display" value={set.name} aria-label="Nom de la setlist"
                    onChange={e => update(s => ({ ...s, name: e.target.value }))} onBlur={e => !e.target.value.trim() && update(s => ({ ...s, name: 'Sans titre' }))} />
                : <span className="display set-title">{set.name.toUpperCase()}</span>}
            </div>
          </div>
          <button className={'edit-btn' + (edit ? ' on' : '')} onClick={() => { setEdit(!edit); setPicking(false); setConfirmDelete(false); }}>{edit ? 'Terminé' : 'Modifier'}</button>
        </div>

        {edit && (
          <div className="set-date-edit">
            {set.date !== undefined ? (
              <>
                <label className="sheet-field">
                  <span>Date du concert</span>
                  <input className="text-input" type="datetime-local" value={toLocalInput(set.date)} onChange={e => setDate(e.target.value)} />
                </label>
                <button className="btn-link" onClick={() => setDate('')}>Retirer la date</button>
              </>
            ) : (
              <button className="btn-link" onClick={addDate}>+ Ajouter une date</button>
            )}
          </div>
        )}

        <div className="set-info">
          {set.date !== undefined && <><span>{setDateLabel(set)}</span><span className="sep">·</span></>}
          <span>{titlesLabel(set.songIds.length)}</span>
          <span className="sep">·</span>
          <span>{fmtMin(setDuration(set))}</span>
          {gap > 0 && set.songIds.length > 1 && <><span className="sep">·</span><span>{fmtHMs(timeline.total)} avec les enchaînements</span></>}
        </div>

        <div className="songs">
          {set.songIds.map((id, i) => {
            const s = songById(id);
            if (!s) return null;
            return (
              <div key={id} className={'song-row' + (edit ? ' editing' : '')} role={edit ? undefined : 'button'} tabIndex={edit ? undefined : 0}
                onClick={() => !edit && nav(`/scene/${set.id}/play/${i}`)}
                onKeyDown={e => { if (!edit && e.key === 'Enter') nav(`/scene/${set.id}/play/${i}`); }}>
                <span className="song-num mono">{i + 1}</span>
                <div className="song-text" onClick={() => edit && nav(`/scene/morceau/${s.id}`)}>
                  <span className="song-title">{s.title}{edit && <span className="song-edit"> ✎</span>}</span>
                  <span className="song-meta">{songMeta(s)}{hasLyrics(s.chordpro) ? '' : s.chordpro ? ' · accords' : ' · à écrire'}</span>
                  {!edit && set.memos?.[id] && <span className="song-memo">{set.memos[id]}</span>}
                  {edit && (
                    <input className="text-input song-memo-input" value={set.memos?.[id] ?? ''} placeholder="Mémo : accordage, capo, son, qui lance l’intro…"
                      aria-label={`Mémo pour ${s.title}`} onClick={e => e.stopPropagation()} onChange={e => setMemo(id, e.target.value)} />
                  )}
                </div>
                {edit ? (
                  <div className="song-tools">
                    <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Monter ${s.title}`}>▲</button>
                    <button onClick={() => move(i, 1)} disabled={i === set.songIds.length - 1} aria-label={`Descendre ${s.title}`}>▼</button>
                    <button className="rm" onClick={() => remove(i)} aria-label={`Retirer ${s.title}`}>−</button>
                  </div>
                ) : (
                  <span className="song-dur mono">
                    {set.date !== undefined && <span className="song-at" aria-label={`Début prévu à ${fmtClock(set.date + timeline.starts[i] * 1000)}`}>{fmtClock(set.date + timeline.starts[i] * 1000)}</span>}
                    {fmtDur(s.duration)}
                  </span>
                )}
              </div>
            );
          })}
          {!set.songIds.length && !edit && <div className="songs-empty">Aucun titre. Touchez « Modifier » pour en ajouter.</div>}
          {edit && (
            <button className="add-song" onClick={() => setPicking(!picking)}>
              {picking ? 'Fermer la liste' : '+ Ajouter un titre'}
            </button>
          )}
          {edit && picking && (
            <div className="picker">
              <button className="pick-row new-song" onClick={createSong}>
                <div className="song-text">
                  <span className="song-title">Créer un morceau</span>
                  <span className="song-meta">Titre, ton, tempo, paroles et accords</span>
                </div>
                <span className="pick-plus">+</span>
              </button>
              {available.map(s => (
                <button key={s.id} className="pick-row" onClick={() => add(s.id)}>
                  <div className="song-text">
                    <span className="song-title">{s.title}</span>
                    <span className="song-meta">{songMeta(s)}</span>
                  </div>
                  <span className="pick-plus">+</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {edit && set.songIds.length > 1 && (
          <label className="set-gap">Entre deux morceaux
            <select value={gap} onChange={e => update(s => ({ ...s, gap: Number(e.target.value) }))} aria-label="Temps entre deux morceaux">
              {GAPS.map(g => <option key={g} value={g}>{g === 0 ? 'aucune pause' : g < 60 ? `${g} s` : `${g / 60} min`}</option>)}
            </select>
          </label>
        )}
        <Checklist items={checklistOf(set)} edit={edit} onChange={setChecklist} />
        {!edit && set.songIds.length > 0 && (
          <button className="btn-outline set-pdf" onClick={() => void sharePdf(set.name, setlistPdf(set))}>PDF du set (pour le groupe ou à imprimer)</button>
        )}
        {edit && (
          <div className="set-delete">
            {confirmDelete ? (
              <>
                <p className="help">Supprimer « {set.name} » ? Les morceaux restent dans la bibliothèque.</p>
                <div className="confirm-row">
                  <button className="btn-outline" onClick={() => setConfirmDelete(false)}>Annuler</button>
                  <button className="btn-danger" onClick={deleteSet}>Supprimer</button>
                </div>
              </>
            ) : (
              <button className="btn-outline danger" onClick={() => setConfirmDelete(true)}>Supprimer la setlist…</button>
            )}
          </div>
        )}
      </div>
      {!edit && (
        <button className="cta" disabled={!set.songIds.length} onClick={() => nav(`/scene/${set.id}/play/0`)}>▶  Jouer le set</button>
      )}
      <TabBar active={3} />
    </Phone>
  );
}

/** « Avant de monter sur scène »: ticked off before the concert, edited with « Modifier ». */
function Checklist({ items, edit, onChange }: { items: CheckItem[]; edit: boolean; onChange: (fn: (c: CheckItem[]) => CheckItem[]) => void }) {
  const [draft, setDraft] = useState('');
  const done = items.filter(x => x.done).length;
  const add = () => { if (draft.trim()) { onChange(c => [...c, { id: 'c' + Date.now(), text: draft.trim().slice(0, 80), done: false }]); setDraft(''); } };
  return (
    <section className="set-check" aria-label="Avant de monter sur scène">
      <div className="set-check-head">
        <span className="kicker">Avant de monter sur scène</span>
        <span className="mono">{done}/{items.length}</span>
      </div>
      {items.map(x => (
        <div key={x.id} className="set-check-row">
          <label className={x.done ? 'done' : ''}>
            <input type="checkbox" checked={x.done} onChange={() => onChange(c => c.map(y => (y.id === x.id ? { ...y, done: !y.done } : y)))} />
            {x.text}
          </label>
          {edit && <button className="rm" aria-label={`Retirer « ${x.text} »`} onClick={() => onChange(c => c.filter(y => y.id !== x.id))}>−</button>}
        </div>
      ))}
      {edit && (
        <div className="set-check-add">
          <input className="text-input" value={draft} placeholder="Ajouter (ex. capo, jack de secours)" aria-label="Nouvelle chose à vérifier"
            onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} />
          <button className="btn-outline" disabled={!draft.trim()} onClick={add}>Ajouter</button>
        </div>
      )}
      {done > 0 && <button className="btn-link small" onClick={() => onChange(c => c.map(y => ({ ...y, done: false })))}>Tout décocher (prochain concert)</button>}
    </section>
  );
}
