import { useEffect, useRef, useState } from 'react';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { BPM_RANGE, TRACKS, buildBacking, chordLabel, trackKey, type Track } from '../lib/backing';
import { MetronomeEngine, type Pattern } from '../lib/metronome';
import { mod12 } from '../lib/music';
import { usePedal } from '../lib/pedal';
import { useStoredState } from '../lib/store';
import './Backing.css';
import { MyBackingPanel } from '../components/MyBackingPanel';
import { markUsed } from '../lib/usage';
import { FileControls } from '../components/FileControls';
import { deleteBlob } from '../lib/blobs';
import { MY_TRACKS_KEY, attachedTo, fmtTime, type MyTrack } from '../lib/myBacking';
import { storeAudioFile, useFilePlayer } from '../lib/useFilePlayer';
import { useDropOffered } from '../lib/dropped';

const STYLES = ['Tous', 'Blues', 'Rock', 'Funk'] as const;
type Tweaks = Record<string, { key: number; bpm: number }>;

export default function Backing() {
  const [style, setStyle] = useStoredState<(typeof STYLES)[number]>('backing.style', 'Tous');
  /** The app's synthesised tracks, or the player's own audio files. */
  const [source, setSource] = useStoredState<'app' | 'mine'>('backing.source', 'app');
  const stopMine = useRef<() => void>(() => {});
  // Audio dropped on the window: into « Mes fichiers ».
  useDropOffered('audio', () => setSource('mine'));
  const [selId, setSelId] = useStoredState<string | null>('backing.sel', null);
  const [tweaks, setTweaks] = useStoredState<Tweaks>('backing.tweaks', {});
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState({ bar: 0, beat: -1 });

  const sel = TRACKS.find(t => t.id === selId) ?? null;
  /** Audio files the player attached to the app's tracks (one per track, chosen or kept aside). */
  const [mine, setMine] = useStoredState<MyTrack[]>(MY_TRACKS_KEY, []);
  const fileOf = (t: Track) => attachedTo(mine, t.id);
  const usesFile = (t: Track) => { const f = fileOf(t); return !!f && f.active !== false; };
  const [fileMsg, setFileMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const fp = useFilePlayer(text => setFileMsg({ text, error: true }));
  const tw = (t: Track) => tweaks[t.id] ?? { key: t.key, bpm: t.bpm };

  // The engine pulls the latest settings every step; the pattern is rebuilt only when they change.
  const live = useRef<{ t: Track | null; key: number; bpm: number }>({ t: null, key: 0, bpm: 90 });
  live.current = sel ? { t: sel, ...tw(sel) } : { t: null, key: 0, bpm: 90 };
  const cache = useRef<{ sig: string; p: Pattern } | null>(null);
  const engine = useRef<MetronomeEngine | null>(null);
  if (!engine.current) {
    engine.current = new MetronomeEngine(() => {
      const { t, key, bpm } = live.current;
      const sig = `${t!.id}|${key}|${bpm}`;
      if (cache.current?.sig !== sig) cache.current = { sig, p: buildBacking(t!, key, bpm) };
      return cache.current.p;
    }, (beat, bar) => setPos({ bar, beat }));
  }
  useEffect(() => () => engine.current?.dispose(), []);

  const play = (t: Track) => {
    const f = fileOf(t);
    if (f && f.active !== false) {
      // The attached file instead of the app's sound.
      engine.current!.stop(); setPlaying(false); stopMine.current();
      if (sel?.id !== t.id) setSelId(t.id);
      void fp.toggle(f).then(on => on && markUsed('backing'));
      return;
    }
    fp.pause();
    const e = engine.current!;
    if (sel?.id === t.id && playing) { e.stop(); setPlaying(false); return; }
    if (sel?.id !== t.id) { setSelId(t.id); live.current = { t, ...tw(t) }; e.rewind(); setPos({ bar: 0, beat: -1 }); }
    stopMine.current();
    if (!e.running) e.start();
    markUsed('backing');
    setPlaying(true);
  };
  const stop = () => { engine.current!.stop(); setPlaying(false); setPos({ bar: 0, beat: -1 }); fp.pause(); };
  const close = () => { stop(); fp.release(); setSelId(null); setConfirmUnlink(false); setFileMsg(null); };

  /** Chooses the sound of the open track: the app's (chords, grid, key, tempo) or the attached file. */
  const chooseSound = (useFile: boolean) => {
    const f = sel && fileOf(sel);
    if (!f || (f.active !== false) === useFile) return;
    stop();
    setMine(list => list.map(x => (x.id === f.id ? { ...x, active: useFile } : x)));
  };
  /** Attaches an audio file to the open track (replacing the previous one) and chooses it. */
  const attach = async (files: FileList | null) => {
    const file = files?.[0];
    if (fileInput.current) fileInput.current.value = '';
    if (!file || !sel) return;
    setFileMsg(null);
    const r = await storeAudioFile(file, { trackId: sel.id, active: true });
    if (r === 'refused') { setFileMsg({ text: `« ${file.name} » n’est pas un son lu par ce navigateur.`, error: true }); return; }
    if (r === 'full') { setFileMsg({ text: 'Plus de place sur l’appareil pour garder ce fichier.', error: true }); return; }
    const old = fileOf(sel);
    stop(); fp.release();
    if (old) void deleteBlob(old.id);
    setMine(list => [r, ...list.filter(x => x.id !== old?.id)]);
    setFileMsg({ text: `« ${r.name} » associé à ${sel.name}.` });
  };
  const unlink = () => {
    const f = sel && fileOf(sel);
    if (!f) return;
    stop(); fp.release();
    void deleteBlob(f.id);
    setMine(list => list.filter(x => x.id !== f.id));
    setConfirmUnlink(false);
    setFileMsg({ text: 'Fichier retiré : le son RIFFBOX est utilisé.' });
  };
  const tweak = (d: { key?: number; bpm?: number }) => {
    if (!sel) return;
    const cur = tw(sel);
    setTweaks({ ...tweaks, [sel.id]: { key: d.key ?? cur.key, bpm: Math.max(BPM_RANGE[0], Math.min(BPM_RANGE[1], d.bpm ?? cur.bpm)) } });
  };

  const shown = TRACKS.filter(t => style === 'Tous' || t.style === style);

  // Pedal: play / pause the open track (or the first one shown), or start again from bar 1.
  const pedalPlay = () => { const t = sel ?? shown[0]; if (t) play(t); };
  usePedal(source === 'app' ? {
    right: pedalPlay,
    middle: pedalPlay,
    left: () => { if (sel && usesFile(sel)) fp.restart(); else if (sel) { engine.current!.rewind(); setPos({ bar: 0, beat: -1 }); } },
  } : {});
  const cur = sel ? tw(sel) : null;
  const bars = sel?.bars ?? [];
  const attached = sel ? fileOf(sel) : undefined;
  const selFile = !!attached && attached.active !== false;
  const anyPlaying = selFile ? fp.current === attached!.id && fp.playing : playing;

  return (
    <Phone label="07 Backing tracks">
      <StatusBar />
      <div className={'backing-scroll' + ((source === 'app' && sel) || source === 'mine' ? ' with-player' : '') + (source === 'app' && sel ? ' with-sound' : '')}>
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/pratiquer" />
            <div className="head-titles">
              <span className="kicker">Pratiquer</span>
              <h1 className="display" style={{ fontSize: 28, whiteSpace: 'nowrap' }}>BACKING TRACKS</h1>
            </div>
          </div>
        </div>

        <div className="seg" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }} role="group" aria-label="Source">
          <button className={source === 'app' ? 'on' : ''} aria-pressed={source === 'app'} onClick={() => setSource('app')}>RIFFBOX</button>
          <button className={source === 'mine' ? 'on' : ''} aria-pressed={source === 'mine'} onClick={() => { setSource('mine'); close(); }}>Mes fichiers</button>
        </div>

        {source === 'mine' && <MyBackingPanel onStart={stop} stopRef={stopMine} />}

        {source === 'app' && (
        <div className="seg seg-dim" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
          {STYLES.map(s => <button key={s} className={s === style ? 'on' : ''} onClick={() => setStyle(s)}>{s}</button>)}
        </div>
        )}

        {source === 'app' && shown.map(t => {
          const v = tw(t);
          const f = fileOf(t);
          const viaFile = !!f && f.active !== false;
          const isSel = sel?.id === t.id, isPlaying = isSel && (viaFile ? fp.current === f.id && fp.playing : playing);
          return (
            <div key={t.id} className={'track' + (isSel ? ' sel' : '')}>
              <button className={'track-play' + (isPlaying ? ' on' : '')} onClick={() => play(t)} aria-label={isPlaying ? `Pause ${t.name}` : `Lire ${t.name}`}>
                {isPlaying ? '❚❚' : '▶'}
              </button>
              <div className="track-text">
                <span className="track-name">{t.name}</span>
                <span className="track-form">{viaFile ? `♪ Mon fichier · ${f.name}` : t.form}</span>
              </div>
              <div className="track-tags">
                <span className="tag key">{trackKey(v.key, t.minor)}</span>
                <span className="track-bpm mono">{v.bpm} BPM</span>
              </div>
            </div>
          );
        })}
      </div>

      {source === 'app' && sel && cur && (
        <div className="player" role="region" aria-label="Lecteur">
          <div className="player-head">
            <span className="player-kicker"><span className={'led' + (anyPlaying ? ' on' : '')} style={{ width: 8, height: 8 }} />{anyPlaying ? 'En lecture' : 'En pause'} · {sel.name}</span>
            <button className="player-close" onClick={close} aria-label="Fermer le lecteur">✕</button>
          </div>

          <div className="sound-row">
            <span className="sound-label">Son</span>
            <div className="seg sound-seg" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }} role="group" aria-label="Son de la backing track">
              <button className={!selFile ? 'on' : ''} aria-pressed={!selFile} onClick={() => chooseSound(false)}>RIFFBOX</button>
              <button className={selFile ? 'on' : ''} aria-pressed={selFile} onClick={() => (attached ? chooseSound(true) : fileInput.current?.click())}>Mon fichier</button>
            </div>
          </div>
          <div className="sound-file">
            {attached ? (
              confirmUnlink ? (
                <>
                  <span>Retirer « {attached.name} » ?</span>
                  <button className="btn-link" onClick={() => setConfirmUnlink(false)}>Annuler</button>
                  <button className="btn-link danger" onClick={unlink}>Retirer</button>
                </>
              ) : (
                <>
                  <span className="sound-name">♪ {attached.name} · {fmtTime(attached.duration)}</span>
                  <button className="btn-link" onClick={() => fileInput.current?.click()}>Changer</button>
                  <button className="btn-link" onClick={() => setConfirmUnlink(true)}>Retirer</button>
                </>
              )
            ) : (
              <button className="btn-link" onClick={() => fileInput.current?.click()}>+ Associer un fichier audio à {sel.name}…</button>
            )}
          </div>
          {fileMsg && <p className={'backup-msg' + (fileMsg.error ? ' error' : '')} role="status">{fileMsg.text}</p>}

          {selFile && attached ? (
            <FileControls track={attached} player={fp} onUpdate={patch => setMine(list => list.map(x => (x.id === attached.id ? { ...x, ...patch } : x)))}
              playButton={<button className={'play-btn player-toggle' + (anyPlaying ? ' on' : '')} onClick={() => play(sel)}>{anyPlaying ? 'PAUSE' : 'LECTURE'}</button>} />
          ) : (<>
          <div className="player-now">
            <span className="player-chord">{chordLabel(cur.key, bars[pos.bar])}</span>
            <div className="player-next">
              <span>puis <b>{chordLabel(cur.key, bars[(pos.bar + 1) % bars.length])}</b></span>
              <span className="mono">Mesure {pos.bar + 1}/{bars.length}</span>
            </div>
            <div className="player-beats">{[0, 1, 2, 3].map(b => <span key={b} className={b === pos.beat ? 'on' : ''} />)}</div>
          </div>

          <div className="player-bars" aria-hidden>
            {bars.map((c, i) => (
              <span key={i} className={(i === pos.bar ? 'on ' : '') + (c.deg === 0 ? 'tonic' : '')}>{chordLabel(cur.key, c)}</span>
            ))}
          </div>

          <div className="player-ctrls">
            <div className="stepper">
              <button onClick={() => tweak({ key: mod12(cur.key - 1) })} aria-label="Baisser d’un demi-ton">−</button>
              <div><span>Ton</span><span className="mono">{trackKey(cur.key, sel.minor)}</span></div>
              <button onClick={() => tweak({ key: mod12(cur.key + 1) })} aria-label="Monter d’un demi-ton">+</button>
            </div>
            <button className={'play-btn player-toggle' + (playing ? ' on' : '')} onClick={() => play(sel)}>{playing ? 'PAUSE' : 'LECTURE'}</button>
            <div className="stepper">
              <button onClick={() => tweak({ bpm: cur.bpm - 2 })} aria-label="Ralentir">−</button>
              <div><span>Tempo</span><span className="mono">{cur.bpm}</span></div>
              <button onClick={() => tweak({ bpm: cur.bpm + 2 })} aria-label="Accélérer">+</button>
            </div>
          </div>
          </>)}
        </div>
      )}
      <input ref={fileInput} type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.flac,.aif,.aiff" hidden aria-label="Fichier audio de la backing track" onChange={e => void attach(e.target.files)} />
      <TabBar active={2} />
    </Phone>
  );
}
