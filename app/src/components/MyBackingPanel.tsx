import { useEffect, useRef, useState } from 'react';
import { deleteBlob, getBlob, putBlob } from '../lib/blobs';
import { BIG_FILE, MY_TRACKS_KEY, SPEED, clampSpeed, fmtSize, fmtTime, fromFileName, isAudioFile, type MyTrack } from '../lib/myBacking';
import { KEY_FR } from '../lib/music';
import { usePedal } from '../lib/pedal';
import { useStoredState } from '../lib/store';
import { useDialog } from '../lib/useDialog';
import { markUsed } from '../lib/usage';
import './MyBackingPanel.css';
import { useDropped } from '../lib/dropped';

/** Length of an audio file, or null when this browser cannot read it. */
function probeDuration(blob: Blob): Promise<number | null> {
  return new Promise(resolve => {
    const a = new Audio();
    const url = URL.createObjectURL(blob);
    const done = (v: number | null) => { URL.revokeObjectURL(url); a.removeAttribute('src'); resolve(v); };
    const timer = setTimeout(() => done(null), 10_000);
    a.preload = 'metadata';
    a.onloadedmetadata = () => { clearTimeout(timer); done(Number.isFinite(a.duration) ? a.duration : 0); };
    a.onerror = () => { clearTimeout(timer); done(null); };
    a.src = url;
  });
}
const keyName = (t: MyTrack) => (t.key === undefined ? '' : `${KEY_FR[t.key]}${t.minor ? ' m' : ''}`);

/**
 * « Mes fichiers » of the backing tracks: the player's own audio files, kept on the device, played
 * in a loop at the chosen speed (pitch kept). `onStart` stops whatever else is playing.
 */
export function MyBackingPanel({ onStart, stopRef }: { onStart: () => void; stopRef: React.MutableRefObject<() => void> }) {
  const [all, setTracks] = useStoredState<MyTrack[]>(MY_TRACKS_KEY, []);
  // Files attached to one of the app's tracks live with that track, not in this list.
  const tracks = all.filter(t => !t.trackId);
  const [selId, setSelId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const dlg = useDialog(() => setEditing(null));

  const sel = tracks.find(t => t.id === selId) ?? null;
  const update = (id: string, patch: Partial<MyTrack>) => setTracks(list => list.map(t => (t.id === id ? { ...t, ...patch } : t)));

  const release = () => {
    audio.current?.pause();
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
    audio.current = null;
  };
  const pause = () => { audio.current?.pause(); setPlaying(false); };
  stopRef.current = pause;
  useEffect(() => release, []);

  /** Loads a track into the player (without playing). */
  const load = async (t: MyTrack): Promise<HTMLAudioElement | null> => {
    if (selId === t.id && audio.current) return audio.current;
    release();
    const blob = await getBlob(t.id);
    if (!blob) { setMsg({ text: `Le son de « ${t.name} » n’est pas sur cet appareil.`, error: true }); return null; }
    const a = new Audio();
    url.current = URL.createObjectURL(blob);
    a.src = url.current;
    a.loop = t.loop ?? true;
    a.playbackRate = t.speed ?? 1;
    (a as HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean }).preservesPitch = true;
    (a as HTMLAudioElement & { webkitPreservesPitch?: boolean }).webkitPreservesPitch = true;
    a.ontimeupdate = () => setTime(a.currentTime);
    a.onended = () => { setPlaying(false); setTime(0); };
    audio.current = a;
    setSelId(t.id); setTime(0);
    return a;
  };

  const toggle = async (t: MyTrack) => {
    if (selId === t.id && playing) { pause(); return; }
    const a = await load(t);
    if (!a) return;
    onStart();
    try { await a.play(); setPlaying(true); markUsed('backing'); }
    catch { setMsg({ text: 'Lecture impossible : ce format n’est pas lu par ce navigateur.', error: true }); }
  };
  const restart = () => { if (audio.current) { audio.current.currentTime = 0; setTime(0); } };
  const close = () => { release(); setSelId(null); setPlaying(false); };
  const seek = (v: number) => { if (audio.current) { audio.current.currentTime = v; setTime(v); } };
  const setSpeed = (v: number) => { if (!sel) return; const s = clampSpeed(v); update(sel.id, { speed: s }); if (audio.current) audio.current.playbackRate = s; };
  const setLoop = (on: boolean) => { if (!sel) return; update(sel.id, { loop: on }); if (audio.current) audio.current.loop = on; };

  usePedal({
    right: () => { const t = sel ?? tracks[0]; if (t) void toggle(t); },
    middle: () => { const t = sel ?? tracks[0]; if (t) void toggle(t); },
    left: restart,
  });

  const add = async (files: FileList | File[] | null) => {
    if (!files?.length) return;
    setMsg(null); setBusy(true);
    const added: MyTrack[] = [];
    const refused: string[] = [];
    let big = false;
    for (const f of Array.from(files)) {
      if (!isAudioFile(f)) { refused.push(f.name); continue; }
      const duration = await probeDuration(f);
      if (duration === null) { refused.push(f.name); continue; }
      const id = 'bt' + Date.now() + Math.random().toString(36).slice(2, 6);
      if (!(await putBlob(id, f))) { setMsg({ text: 'Plus de place sur l’appareil pour garder ce fichier.', error: true }); break; }
      big ||= f.size > BIG_FILE;
      added.push({ id, ...fromFileName(f.name), created: Date.now(), size: f.size, type: f.type || 'audio/*', duration: Math.round(duration), loop: true });
    }
    if (input.current) input.current.value = '';
    setBusy(false);
    if (added.length) setTracks(list => [...added, ...list]);
    const parts = [
      added.length ? `${added.length} fichier${added.length > 1 ? 's' : ''} ajouté${added.length > 1 ? 's' : ''}.` : '',
      refused.length ? `Non lu${refused.length > 1 ? 's' : ''} par ce navigateur : ${refused.join(', ')}.` : '',
      big ? 'Fichier volumineux : il prend de la place sur l’appareil et dans les sauvegardes.' : '',
    ].filter(Boolean);
    if (parts.length) setMsg({ text: parts.join(' '), error: !added.length });
  };

  useDropped('audio', files => void add(files));

  const remove = (id: string) => {
    if (selId === id) close();
    setTracks(list => list.filter(t => t.id !== id));
    void deleteBlob(id);
    setEditing(null); setConfirmDelete(false);
  };

  const ed = tracks.find(t => t.id === editing) ?? null;
  const speed = sel?.speed ?? 1;

  return (
    <>
      <button className="btn-outline my-add" onClick={() => input.current?.click()} disabled={busy}>{busy ? 'Lecture du fichier…' : '+ Ajouter un fichier audio'}</button>
      <input ref={input} type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.flac,.aif,.aiff" multiple hidden aria-label="Fichiers audio" onChange={e => void add(e.target.files)} />
      {msg && <p className={'backup-msg' + (msg.error ? ' error' : '')} role="status">{msg.text}</p>}
      {!tracks.length && (
        <p className="my-empty">Ajoutez vos propres backing tracks (MP3, M4A, WAV, OGG…) : elles restent sur cet appareil, se jouent en boucle et
          se ralentissent sans changer de ton. Elles suivent les sauvegardes et le transfert vers la tablette.</p>
      )}

      {tracks.map(t => {
        const isSel = selId === t.id, isPlaying = isSel && playing;
        return (
          <div key={t.id} className={'track' + (isSel ? ' sel' : '')}>
            <button className={'track-play' + (isPlaying ? ' on' : '')} onClick={() => void toggle(t)} aria-label={isPlaying ? `Pause ${t.name}` : `Lire ${t.name}`}>
              {isPlaying ? '❚❚' : '▶'}
            </button>
            <button className="track-text my-text" onClick={() => { setEditing(t.id); setConfirmDelete(false); }} aria-label={`Modifier ${t.name}`}>
              <span className="track-name">{t.name}</span>
              <span className="track-form">{fmtTime(t.duration)} · {fmtSize(t.size)}{t.speed && t.speed !== 1 ? ` · vitesse ${Math.round(t.speed * 100)} %` : ''}</span>
            </button>
            <div className="track-tags">
              {t.key !== undefined && <span className="tag key">{keyName(t)}</span>}
              {t.bpm && <span className="track-bpm mono">{t.bpm} BPM</span>}
            </div>
          </div>
        );
      })}

      {sel && (
        <div className="player my-player" role="region" aria-label="Lecteur">
          <div className="player-head">
            <span className="player-kicker"><span className={'led' + (playing ? ' on' : '')} style={{ width: 8, height: 8 }} />{playing ? 'En lecture' : 'En pause'} · {sel.name}</span>
            <button className="player-close" onClick={close} aria-label="Fermer le lecteur">✕</button>
          </div>
          <div className="my-seek">
            <span className="mono">{fmtTime(time)}</span>
            <input type="range" min={0} max={Math.max(1, sel.duration)} step={0.1} value={Math.min(time, sel.duration)} aria-label="Position" onChange={e => seek(Number(e.target.value))} />
            <span className="mono">{fmtTime(sel.duration)}</span>
          </div>
          <div className="player-ctrls">
            <div className="stepper">
              <button onClick={() => setSpeed(speed - SPEED.step)} disabled={speed <= SPEED.min} aria-label="Plus lent">−</button>
              <div><span>Vitesse</span><span className="mono">{Math.round(speed * 100)} %</span></div>
              <button onClick={() => setSpeed(speed + SPEED.step)} disabled={speed >= SPEED.max} aria-label="Plus rapide">+</button>
            </div>
            <button className={'play-btn player-toggle' + (playing ? ' on' : '')} onClick={() => void toggle(sel)}>{playing ? 'PAUSE' : 'LECTURE'}</button>
            <div className="my-side">
              <button className={'my-loop' + ((sel.loop ?? true) ? ' on' : '')} aria-pressed={sel.loop ?? true} onClick={() => setLoop(!(sel.loop ?? true))}>↻ Boucle</button>
              <button className="my-restart" onClick={restart}>⏮ Début</button>
            </div>
          </div>
          {sel.bpm && speed !== 1 && <p className="my-note">À cette vitesse : {Math.round(sel.bpm * speed)} BPM.</p>}
        </div>
      )}

      {ed && (
        <div className="sheet-backdrop" onClick={() => setEditing(null)}>
          <div className="set-sheet" ref={dlg} role="dialog" aria-label="Modifier la backing track" onClick={e => e.stopPropagation()}>
            <div className="set-sheet-head">
              <span className="kicker sheet-kicker">Ma backing track</span>
              <button className="player-close" onClick={() => setEditing(null)} aria-label="Fermer">✕</button>
            </div>
            <label className="sheet-field">
              <span>Nom</span>
              <input className="text-input" value={ed.name} maxLength={60} onChange={e => update(ed.id, { name: e.target.value })}
                onBlur={e => !e.target.value.trim() && update(ed.id, { name: 'Backing track' })} />
            </label>
            <label className="sheet-field">
              <span>Tonalité</span>
              <select className="text-input" value={ed.key === undefined ? '' : `${ed.key}${ed.minor ? 'm' : ''}`}
                onChange={e => { const v = e.target.value; update(ed.id, v ? { key: parseInt(v, 10), minor: v.endsWith('m') || undefined } : { key: undefined, minor: undefined }); }}>
                <option value="">Non précisée</option>
                {KEY_FR.map((k, i) => <option key={i} value={i}>{k} majeur</option>)}
                {KEY_FR.map((k, i) => <option key={'m' + i} value={`${i}m`}>{k} mineur</option>)}
              </select>
            </label>
            <div className="sheet-field row">
              <span>Tempo</span>
              <div className="mini-stepper">
                <button onClick={() => update(ed.id, { bpm: ed.bpm ? (ed.bpm > 40 ? ed.bpm - 1 : undefined) : 90 })} aria-label="Ralentir">−</button>
                <span className="mono">{ed.bpm ? `${ed.bpm} BPM` : '—'}</span>
                <button onClick={() => update(ed.id, { bpm: Math.min(300, (ed.bpm ?? 89) + 1) })} aria-label="Accélérer">+</button>
              </div>
            </div>
            <p className="sheet-empty">{fmtTime(ed.duration)} · {fmtSize(ed.size)} · gardé sur cet appareil.</p>
            {confirmDelete ? (
              <div className="confirm-row">
                <button className="btn-outline" onClick={() => setConfirmDelete(false)}>Annuler</button>
                <button className="btn-danger" onClick={() => remove(ed.id)}>Supprimer</button>
              </div>
            ) : (
              <button className="btn-outline danger" onClick={() => setConfirmDelete(true)}>Supprimer ce fichier…</button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
