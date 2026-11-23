import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Phone, StatusBar } from '../components/Chrome';
import { SETTINGS, SPEEDS } from '../lib/data';
import { parseChordPro } from '../lib/music';
import { INITIAL_SETLISTS, songById, songKey, type Setlist, type Song } from '../lib/setlists';
import { readStored, useStoredState } from '../lib/store';
import { usePedal } from '../lib/pedal';
import { useWakeLock } from '../lib/wakeLock';
import { useGuitarFollow } from './useGuitarFollow';
import { followEvents } from '../lib/chordFollow';
import { StageChords } from '../components/StageChords';
import './Prompteur.css';
import { useMarkUsed } from '../lib/usage';

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
  const wake = useWakeLock();
  useMarkUsed('setlists'); // playing a set
  const [follow, setFollow] = useStoredState('stage.follow', false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pos = useRef(0);

  const lines = useMemo(() => (song.chordpro ? parseChordPro(song.chordpro, trans) : []), [song, trans]);
  const fs = readStored(SETTINGS.stageFontSize.key, SETTINGS.stageFontSize.def);
  const gf = useGuitarFollow(lines, scrollRef, follow);
  const [showChords, setShowChords] = useStoredState('stage.diagrams', true);
  const events = useMemo(() => followEvents(lines), [lines]);
  /** Reading position (no guitar following): the first chord whose line is at the top of the lyrics. */
  const [readAt, setReadAt] = useState(0);
  const total = set.songIds.length;
  const hasPrev = index > 0, hasNext = index < total - 1;

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setEdges({ top: el.scrollTop <= 1, bottom: el.scrollTop + el.clientHeight >= el.scrollHeight - 2 });
    const i = events.findIndex(e => {
      const l = el.querySelector<HTMLElement>(`[data-line="${e.line}"]`);
      return !!l && l.offsetTop - el.offsetTop + l.offsetHeight > el.scrollTop + 4;
    });
    setReadAt(i < 0 ? Math.max(0, events.length - 1) : i);
  }, [events]);
  useLayoutEffect(measure, [measure, lines]);

  // Following the guitar and auto-scroll exclude each other.
  useEffect(() => { if (playing) setFollow(false); }, [playing, setFollow]);
  useEffect(() => { if (follow) setPlaying(false); }, [follow]);

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

  // Escape leaves the live, back to the set (a setting being learnt for the pedal is not affected).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) nav(`/scene/${set.id}`); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav, set.id]);

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

  // Bluetooth page turners (keys set in Réglages › Pédalier).
  const { seen: pedal, flash } = usePedal({
    right: () => page(1),
    left: () => page(-1),
    middle: () => { if (lines.length) setPlaying(p => !p); },
  });

  const cur = gf.current ?? events[readAt];
  const curIdx = cur ? events.findIndex(e => e.line === cur.line && e.seg === cur.seg) : -1;
  const nowChord = cur?.chord;
  const nextChord = gf.current ? gf.next?.chord : events.slice(curIdx + 1).find(e => e.chord !== nowChord)?.chord;

  const prevLabel = edges.top ? '‹ Titre préc.' : '‹ Précédent';
  const nextLabel = edges.bottom ? 'Titre suivant ›' : 'Suivant ›';
  const prevOff = edges.top && !hasPrev, nextOff = edges.bottom && !hasNext;

  return (
    <Phone label="08 Live" bg="#0f0e0d" column theme="dark" wide>
      <StatusBar stage />
      <div className="stage-head" data-wakelock={wake}>
        <div className="stage-top">
          <div className="stage-where">
            <Link to={`/scene/${set.id}`} className="stage-back" aria-label={`Quitter le live, retour à ${set.name}`} title="Quitter le live (Échap)">✕ Quitter</Link>
            <span className="stage-pos">{set.name} · {index + 1}/{total}</span>
          </div>
          <div
            className={'stage-pedal' + (pedal ? ' seen' : '') + (flash ? ' flash' : '')}
            role="status"
            title={pedal ? 'Le pédalier répond.' : 'Appuyez sur une pédale pour vérifier qu’elle est reconnue.'}
          >
            <span />{pedal ? 'Pédalier détecté' : 'Pédalier : appuyez'}
          </div>
        </div>
        <h1 className="display stage-title">{song.title.toUpperCase()}</h1>
        <div className="stage-tags">
          <span className="stage-tag key"><span>Ton :</span><span>{songKey(song, trans)}</span></span>
          <span className="stage-tag">{song.bpm} BPM · {song.feel}</span>
          <span className="stage-tag">Capo {song.capo}</span>
          <Link to={`/scene/morceau/${song.id}`} className="stage-tag stage-edit" aria-label="Modifier le morceau">✎</Link>
          {events.length > 0 && (
            <button className={'stage-tag stage-diag' + (showChords ? ' on' : '')} aria-pressed={showChords}
              onClick={() => setShowChords(!showChords)}>Schémas</button>
          )}
          {wake !== 'on' && (
            <span className="stage-tag stage-sleep" title={wake === 'unsupported'
              ? 'Ce navigateur ne sait pas empêcher la mise en veille : allongez le délai de veille du téléphone.'
              : 'La mise en veille n’est pas encore bloquée : touchez l’écran.'}>
              Veille possible
            </span>
          )}
        </div>
      </div>

      <div className="lyrics" ref={scrollRef} onScroll={() => { measure(); gf.onScroll(); }} style={{ '--fs': `${fs}px` } as CSSProperties} tabIndex={0} role="region" aria-label="Paroles">
        {lines.length ? lines.map((l, i) =>
          l.kind === 'section' ? (
            <div key={i} className="lyric-section">{l.label}</div>
          ) : (
            <div key={i} data-line={i} className={'lyric-line' + (l.segs.every(g => !g.text.trim()) ? ' chords-only' : '')}>
              {l.segs.map((g, j) => (
                <div key={j} className={'lyric-seg'
                  + (gf.current?.line === i && gf.current.seg === j ? ' now' : '')
                  + (gf.next?.line === i && gf.next.seg === j ? ' next' : '')}>
                  <span className="lyric-chord"><b>{g.chord.trimEnd()}</b>{g.chord.slice(g.chord.trimEnd().length)}</span>
                  <span className="lyric-text">{g.text}</span>
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

      {showChords && <StageChords now={nowChord} next={nextChord} />}

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
        <div className="follow-row">
          <button className={'follow-btn' + (follow ? ' on' : '')} aria-pressed={follow} disabled={!gf.hasChords}
            title={gf.hasChords ? 'Le texte avance quand vous jouez les accords du morceau.' : 'Ce titre n’a pas d’accords à suivre.'}
            onClick={() => setFollow(!follow)}>
            <span className={'follow-led' + (gf.state === 'on' ? ' on' : '')} aria-hidden />Suivre ma guitare
          </button>
          {follow && (
            <span className="follow-status" role="status">
              {gf.state === 'denied' ? 'Micro refusé'
                : gf.state === 'starting' ? 'Micro…'
                : <>{gf.heard ? <>Entendu <b>{gf.heard}</b></> : 'J’écoute…'}{gf.next && <> · ensuite <b>{gf.next.chord}</b></>}</>}
            </span>
          )}
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
