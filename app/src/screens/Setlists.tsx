import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import {
  INITIAL_SETLISTS, SONGS, fmtDate, fmtDur, fmtMin, setDuration, songById, songMeta, titlesLabel, type Setlist,
} from '../lib/setlists';
import { useStoredState } from '../lib/store';
import './Setlists.css';

export const useSetlists = () => useStoredState<Setlist[]>('setlists', INITIAL_SETLISTS);

/* ---------- 08a · Liste ---------- */

export function SetlistsScreen() {
  const nav = useNavigate();
  const [sets, setSets] = useSetlists();
  const sorted = [...sets].sort((a, b) => a.date - b.date);
  const nextId = sorted.find(s => s.date >= Date.now())?.id;

  const create = () => {
    const id = 'set' + Date.now();
    const n = sets.filter(s => s.name.startsWith('Nouvelle setlist')).length + 1;
    const date = new Date(Date.now() + 7 * 86400000); date.setHours(21, 0, 0, 0);
    setSets([...sets, { id, name: n > 1 ? `Nouvelle setlist ${n}` : 'Nouvelle setlist', date: date.getTime(), songIds: [] }]);
    nav(`/scene/${id}`, { state: { edit: true } });
  };

  return (
    <Phone label="08a Setlists">
      <StatusBar />
      <div className="sets-scroll">
        <div className="head">
          <div className="head-titles">
            <span className="kicker">Scène</span>
            <span className="display" style={{ fontSize: 30 }}>SETLISTS</span>
          </div>
          <span className="sets-count mono">{sets.length} sets</span>
        </div>

        {sorted.map(s => {
          const next = s.id === nextId;
          return (
            <button key={s.id} className={'set-card' + (next ? ' next' : '')} onClick={() => nav(`/scene/${s.id}`)}>
              <div className="set-card-top">
                <span className="set-date mono">{fmtDate(s.date)}</span>
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
  const set = sets.find(s => s.id === setId);
  const loc = useLocation();
  const [edit, setEdit] = useState(() => !!(loc.state as { edit?: boolean } | null)?.edit);
  const [picking, setPicking] = useState(false);

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
  const available = SONGS.filter(s => !set.songIds.includes(s.id));

  return (
    <Phone label="08b Setlist">
      <StatusBar />
      <div className="sets-scroll">
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
          <button className={'edit-btn' + (edit ? ' on' : '')} onClick={() => { setEdit(!edit); setPicking(false); }}>{edit ? 'Terminé' : 'Modifier'}</button>
        </div>

        <div className="set-info">
          <span>{fmtDate(set.date)}</span>
          <span className="sep">·</span>
          <span>{titlesLabel(set.songIds.length)}</span>
          <span className="sep">·</span>
          <span>{fmtMin(setDuration(set))}</span>
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
                <div className="song-text">
                  <span className="song-title">{s.title}</span>
                  <span className="song-meta">{songMeta(s)}{s.chordpro ? '' : ' · sans paroles'}</span>
                </div>
                {edit ? (
                  <div className="song-tools">
                    <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Monter ${s.title}`}>▲</button>
                    <button onClick={() => move(i, 1)} disabled={i === set.songIds.length - 1} aria-label={`Descendre ${s.title}`}>▼</button>
                    <button className="rm" onClick={() => remove(i)} aria-label={`Retirer ${s.title}`}>−</button>
                  </div>
                ) : (
                  <span className="song-dur mono">{fmtDur(s.duration)}</span>
                )}
              </div>
            );
          })}
          {!set.songIds.length && !edit && <div className="songs-empty">Aucun titre. Touchez « Modifier » pour en ajouter.</div>}
          {edit && (
            <button className="add-song" onClick={() => setPicking(!picking)} disabled={!available.length}>
              {picking ? 'Fermer la liste' : '+ Ajouter un titre'}
            </button>
          )}
          {edit && picking && (
            <div className="picker">
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
      </div>
      {!edit && (
        <button className="cta" disabled={!set.songIds.length} onClick={() => nav(`/scene/${set.id}/play/0`)}>▶  Jouer le set</button>
      )}
      <TabBar active={3} />
    </Phone>
  );
}
