import { useEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent, type PointerEvent } from 'react';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { getBlob, putBlob } from '../lib/blobs';
import { createShifter } from '../lib/pitchShift';
import { SPEEDS, clampSemis, clampSpeed, fmtTime, loopJump, peaks, setMark } from '../lib/relever';
import { useStoredState } from '../lib/store';
import { markUsed } from '../lib/usage';
import { isAudioFile } from '../lib/myBacking';
import './Relever.css';

const BLOB_ID = 'relever-current';
interface Track { name: string; duration: number; a: number | null; b: number | null; speed: number; semis: number }
const BARS = 160;

/**
 * Relever : work out a song by ear. A recording slowed down without changing its pitch, a passage
 * looped from A to B, transposed by semitones (to the guitar's key, or a capo's).
 */
export default function Relever() {
  const [track, setTrack] = useStoredState<Track | null>('relever.track', null);
  const [wave, setWave] = useState<number[] | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const graph = useRef<{ ctx: AudioContext; set: (s: number) => void } | null>(null);
  const url = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const live = useRef(track);
  live.current = track;
  useEffect(() => markUsed('relever'), []);

  /** The recording into the player, and its loudness overview. */
  const open = async (blob: Blob, t: Track) => {
    audio.current?.pause();
    if (url.current) URL.revokeObjectURL(url.current);
    const a = new Audio();
    url.current = URL.createObjectURL(blob);
    a.src = url.current;
    const p = a as HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean };
    p.preservesPitch = true; p.webkitPreservesPitch = true;
    a.playbackRate = t.speed;
    a.onended = () => setPlaying(false);
    audio.current = a; graph.current = null;
    setPlaying(false); setTime(0);
    try {
      const ctx = new OfflineAudioContext(1, 1, 44100);
      const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
      setWave(peaks(buf.getChannelData(0), BARS));
    } catch { setWave(null); }
  };
  useEffect(() => {
    if (track) void getBlob(BLOB_ID).then(b => b && open(b, track));
    return () => { audio.current?.pause(); if (url.current) URL.revokeObjectURL(url.current); void graph.current?.ctx.close(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = async (f: File | undefined) => {
    if (fileInput.current) fileInput.current.value = '';
    if (!f) return;
    if (!isAudioFile(f)) { setMsg('Ce fichier n’est pas un son lisible (MP3, WAV, M4A, OGG…).'); return; }
    setMsg(null);
    if (!(await putBlob(BLOB_ID, f))) { setMsg('Plus de place sur l’appareil pour ce fichier.'); return; }
    const t: Track = { name: f.name.replace(/\.[^.]+$/, ''), duration: 0, a: null, b: null, speed: 1, semis: 0 };
    setTrack(t);
    await open(f, t);
  };

  /** The sound goes through the transposer (built at the first play: browsers want a tap). */
  const ensureGraph = async () => {
    if (graph.current || !audio.current) return;
    const ctx = new AudioContext();
    const src = ctx.createMediaElementSource(audio.current);
    try {
      const sh = await createShifter(ctx);
      src.connect(sh.node).connect(ctx.destination);
      sh.set(live.current?.semis ?? 0);
      graph.current = { ctx, set: sh.set };
    } catch {
      src.connect(ctx.destination);
      graph.current = { ctx, set: () => setMsg('Ce navigateur ne sait pas transposer : la vitesse et la boucle marchent.') };
    }
  };

  const toggle = async () => {
    const a = audio.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); return; }
    await ensureGraph();
    await graph.current?.ctx.resume();
    if (track?.a !== null && track?.a !== undefined && track.b !== null && (a.currentTime < track.a || a.currentTime >= track.b)) a.currentTime = track.a;
    try { await a.play(); setPlaying(true); } catch { setMsg('Lecture impossible : ce format n’est pas lu par ce navigateur.'); }
  };

  // The playhead, and the A–B loop (checked every frame, for a tight loop).
  useEffect(() => {
    if (!playing) return;
    let raf = requestAnimationFrame(function tick() {
      const a = audio.current, t = live.current;
      if (a && t) {
        const jump = loopJump(a.currentTime, t.a, t.b);
        if (jump !== null) a.currentTime = jump;
        setTime(a.currentTime);
        if (!t.duration && Number.isFinite(a.duration)) setTrack({ ...t, duration: a.duration });
      }
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (p: Partial<Track>) => { if (track) setTrack({ ...track, ...p }); };
  const seek = (t: number) => { const a = audio.current; if (!a) return; a.currentTime = Math.max(0, Math.min(t, (a.duration || t))); setTime(a.currentTime); };
  const speed = (v: number) => { const s = clampSpeed(v); if (audio.current) audio.current.playbackRate = s; patch({ speed: s }); };
  const semis = (v: number) => { const s = clampSemis(v); graph.current?.set(s); patch({ semis: s }); };
  const mark = (which: 'a' | 'b') => track && patch(setMark(which, audio.current?.currentTime ?? time, track.a, track.b));
  const dur = audio.current && Number.isFinite(audio.current.duration) ? audio.current.duration : track?.duration || 0;

  const onWave = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (dur) seek(((e.clientX - r.left) / r.width) * dur);
  };
  const onKey = (e: RKeyboardEvent) => {
    if ((e.target as HTMLElement).closest('input')) return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); void toggle(); }
    else if (k === 'arrowleft') seek(time - 5);
    else if (k === 'arrowright') seek(time + 5);
    else if (k === 'a' || k === 'b') mark(k);
  };

  const pct = (t: number | null) => (t !== null && dur ? `${(t / dur) * 100}%` : '0');
  return (
    <Phone label="Relever">
      <StatusBar />
      <div className="screen-body relever" style={{ gap: 14 }} onKeyDown={onKey} tabIndex={-1}>
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/pratiquer" />
            <div className="head-titles">
              <span className="kicker">Pratiquer</span>
              <h1 className="display" style={{ fontSize: 30 }}>RELEVER</h1>
            </div>
          </div>
        </div>

        <button className="btn-outline" onClick={() => fileInput.current?.click()}>{track ? 'Changer de morceau…' : 'Choisir un enregistrement…'}</button>
        <input ref={fileInput} type="file" hidden accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac" aria-label="Enregistrement à relever" onChange={e => void pick(e.target.files?.[0])} />
        {msg && <p className="cp-msg error" role="status">{msg}</p>}

        {!track ? (
          <p className="help">Un morceau à apprendre : ralentissez-le sans changer sa hauteur, bouclez le passage difficile (A → B), transposez-le pour le jouer dans votre ton. Le fichier reste sur cet appareil.</p>
        ) : (
          <>
            <div className="rv-title"><b>{track.name}</b><span className="mono">{fmtTime(time)} / {fmtTime(dur)}</span></div>
            <div className="rv-wave" data-theme="dark" role="slider" aria-label="Position dans le morceau" tabIndex={0}
              aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(time)} aria-valuetext={fmtTime(time)} onPointerDown={onWave}>
              {track.a !== null && track.b !== null && <span className="rv-loop" style={{ left: pct(track.a), width: `calc(${pct(track.b)} - ${pct(track.a)})` }} />}
              <div className="rv-bars">{(wave ?? Array(BARS).fill(0.15)).map((v, i) => <span key={i} style={{ height: `${Math.max(4, v * 100)}%` }} />)}</div>
              {track.a !== null && <span className="rv-mark" style={{ left: pct(track.a) }}>A</span>}
              {track.b !== null && <span className="rv-mark" style={{ left: pct(track.b) }}>B</span>}
              <span className="rv-head" style={{ left: pct(time) }} />
            </div>

            <div className="rv-transport">
              <button className="page-btn" onClick={() => seek(time - 5)} aria-label="Reculer de 5 secondes">−5 s</button>
              <button className={'play-btn' + (playing ? ' on' : '')} onClick={() => void toggle()}>{playing ? 'PAUSE' : 'LECTURE'}</button>
              <button className="page-btn" onClick={() => seek(time + 5)} aria-label="Avancer de 5 secondes">+5 s</button>
            </div>

            <section className="rv-box" aria-label="Boucle">
              <span className="kicker">Boucle A → B</span>
              <div className="rv-row">
                <button className="btn-outline" aria-label={`Début de la boucle (A)${track.a !== null ? ` : ${fmtTime(track.a)}` : ''}`} onClick={() => mark('a')}>A {track.a !== null ? fmtTime(track.a) : ''}</button>
                <button className="btn-outline" aria-label={`Fin de la boucle (B)${track.b !== null ? ` : ${fmtTime(track.b)}` : ''}`} onClick={() => mark('b')}>B {track.b !== null ? fmtTime(track.b) : ''}</button>
                <button className="btn-link" disabled={track.a === null && track.b === null} onClick={() => patch({ a: null, b: null })}>Effacer</button>
              </div>
              <span className="help">Touchez A au début du passage, B à la fin : il tourne en boucle.</span>
            </section>

            <section className="rv-box" aria-label="Vitesse">
              <span className="kicker">Vitesse · {Math.round(track.speed * 100)} %</span>
              <div className="rv-chips" role="group" aria-label="Vitesse">
                {SPEEDS.map(s => <button key={s} className={'chip' + (track.speed === s ? ' on-cream' : '')} aria-pressed={track.speed === s} onClick={() => speed(s)}>{Math.round(s * 100)} %</button>)}
              </div>
              <span className="help">La hauteur ne change pas : seul le tempo ralentit.</span>
            </section>

            <section className="rv-box" aria-label="Transposition">
              <span className="kicker">Transposition</span>
              <div className="stepper">
                <button onClick={() => semis(track.semis - 1)} aria-label="Un demi-ton plus bas">−</button>
                <div><span>Demi-tons</span><span className="mono">{(track.semis > 0 ? '+' : '') + track.semis}</span></div>
                <button onClick={() => semis(track.semis + 1)} aria-label="Un demi-ton plus haut">+</button>
              </div>
              <span className="help">Pour jouer dans votre ton, ou retrouver la hauteur d’une guitare accordée plus bas (−1 pour un accordage en Mi♭).</span>
            </section>
          </>
        )}
      </div>
      <TabBar active={2} />
    </Phone>
  );
}
