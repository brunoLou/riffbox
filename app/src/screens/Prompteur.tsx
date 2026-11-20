import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Phone, StatusBar } from '../components/Chrome';
import { SETTINGS, SPEEDS } from '../lib/data';
import { parseChordPro } from '../lib/music';
import { INITIAL_SETLISTS, songById, songKey, type Setlist, type Song } from '../lib/setlists';
import { readStored, useStoredState } from '../lib/store';
import './Prompteur.css';

/** Auto-scroll rate at 1×, in px per ms (0.8 px every 30 ms in the prototype). */
const BASE_RATE = 0.8 / 30;

/** Route wrapper: /scene/:setId/play/:index. Remounts per song so per-song state resets. */
export default function PrompteurRoute() {
  const { setId, index } = useParams();
  const set = readStored<Setlist[]>('setlists', INITIAL_SETLISTS).find(s => s.id === setId);
  const i = Number(index);
  const song = set && songById(set.songIds[i]);
  if (!set || !song) return <Navigate to={set ? `/scene/${set.id}` : '/scene'} replace />;
  return <Prompteur key={`${set.id}-${i}`} set={set} index={i} song={song} />;
}

function Prompteur({ set, index, song }: { set: Setlist; index: number; song: Song }) {
  const nav = useNavigate();
  const [trans, setTrans] = useStoredState(`stage.trans.${song.id}`, 0);
  const [speed, setSpeed] = useStoredState('stage.speed', 2);
  const [playing, setPlaying] = useState(false);
  const [edges, setEdges] = useState({ top: true, bottom: false });
  const scrollRef = useRef<HTMLDivElement>(null);
  const pos = useRef(0);

  const lines = useMemo(() => (song.chordpro ? parseChordPro(song.chordpro, trans) : []), [song, trans]);
  const fs = readStored(SETTINGS.stageFontSize.key, SETTINGS.stageFontSize.def);
  const total = set.songIds.length;
  const hasPrev = index > 0, hasNext = index < total - 1;

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setEdges({ top: el.scrollTop <= 1, bottom: el.scrollTop + el.clientHeight >= el.scrollHeight - 2 });
  }, []);
  useLayoutEffect(measure, [measure, lines]);

  // Smooth auto-scroll; keeps a float position so slow speeds still move.
  useEffect(() => {
    const el = scrollRef.current;
    if (!playing || !el) return;
    pos.current = el.scrollTop;
    let last = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      pos.current += (now - last) * BASE_RATE * SPEEDS[speed];
      last = now;
      el.scrollTop = pos.current;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) { setPlaying(false); return; }
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);

  const goSong = useCallback((i: number) => nav(`/scene/${set.id}/play/${i}`, { replace: true }), [nav, set.id]);

  /** Pedal / button: turn a page, or change song at the top/bottom of the page. */
  const page = useCallback((dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    if (dir === 1 && edges.bottom) { if (hasNext) goSong(index + 1); return; }
    if (dir === -1 && edges.top) { if (hasPrev) goSong(index - 1); return; }
    const top = Math.max(0, el.scrollTop + dir * el.clientHeight * 0.8);
    pos.current = top;
    el.scrollTo({ top, behavior: playing ? 'auto' : 'smooth' });
  }, [edges, hasNext, hasPrev, goSong, index, playing]);

  // Bluetooth page turners send arrow / PageUp / PageDown keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', 'PageDown'].includes(e.key)) { e.preventDefault(); page(1); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); page(-1); }
      else if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [page]);

  const prevLabel = edges.top ? '‹ Titre préc.' : '‹ Précédent';
  const nextLabel = edges.bottom ? 'Titre suivant ›' : 'Suivant ›';
  const prevOff = edges.top && !hasPrev, nextOff = edges.bottom && !hasNext;

  return (
    <Phone label="08 Scène" bg="#0f0e0d" column>
      <StatusBar stage />
      <div className="stage-head">
        <div className="stage-top">
          <Link to={`/scene/${set.id}`} className="stage-back">‹ {set.name} · {index + 1}/{total}</Link>
          <div className="stage-pedal"><span />Pédalier connecté</div>
        </div>
        <div className="display stage-title">{song.title.toUpperCase()}</div>
        <div className="stage-tags">
          <span className="stage-tag key"><span>Ton :</span><span>{songKey(song, trans)}</span></span>
          <span className="stage-tag">{song.bpm} BPM · {song.feel}</span>
          <span className="stage-tag">Capo {song.capo}</span>
          <Link to={`/scene/morceau/${song.id}`} className="stage-tag stage-edit" aria-label="Modifier le morceau">✎</Link>
        </div>
      </div>

      <div className="lyrics" ref={scrollRef} onScroll={measure}>
        {lines.length ? lines.map((l, i) =>
          l.kind === 'section' ? (
            <div key={i} className="lyric-section">{l.label}</div>
          ) : (
            <div key={i} className={'lyric-line' + (l.segs.every(g => !g.text.trim()) ? ' chords-only' : '')}>
              {l.segs.map((g, j) => (
                <div key={j} className="lyric-seg">
                  <span className="lyric-chord" style={{ fontSize: Math.round(fs * 0.82) }}>{g.chord}</span>
                  <span className="lyric-text" style={{ fontSize: fs }}>{g.text}</span>
                </div>
              ))}
            </div>
          ),
        ) : (
          <div className="no-lyrics">
            <span className="mono">Pas encore de paroles</span>
            Ce titre n’a ni paroles ni accords. Jouez-le de mémoire, puis passez au suivant avec le pédalier.
            <Link to={`/scene/morceau/${song.id}`} className="write-lyrics">Écrire les paroles ›</Link>
          </div>
        )}
        {lines.length > 0 && hasNext && (
          <div className="up-next">À suivre · <b>{songById(set.songIds[index + 1])?.title}</b></div>
        )}
      </div>

      <div className="stage-controls">
        <div className="stepper-row">
          <div className="stepper">
            <button onClick={() => setTrans(Math.max(-11, trans - 1))} aria-label="Transposer vers le bas">−</button>
            <div><span>Transpo.</span><span className="mono">{(trans > 0 ? '+' : '') + trans}</span></div>
            <button onClick={() => setTrans(Math.min(11, trans + 1))} aria-label="Transposer vers le haut">+</button>
          </div>
          <div className="stepper">
            <button onClick={() => setSpeed(Math.max(0, speed - 1))} aria-label="Ralentir le défilement">−</button>
            <div><span>Défil.</span><span className="mono">{SPEEDS[speed]}×</span></div>
            <button onClick={() => setSpeed(Math.min(SPEEDS.length - 1, speed + 1))} aria-label="Accélérer le défilement">+</button>
          </div>
        </div>
        <div className="transport">
          <button className="page-btn" style={{ color: 'var(--muted-3)' }} disabled={prevOff} onClick={() => page(-1)}>{prevLabel}</button>
          <button className={'play-btn' + (playing ? ' on' : '')} disabled={!lines.length} onClick={() => setPlaying(!playing)}>{playing ? 'PAUSE' : 'LECTURE'}</button>
          <button className="page-btn" disabled={nextOff} onClick={() => page(1)}>{nextLabel}</button>
        </div>
      </div>
    </Phone>
  );
}
