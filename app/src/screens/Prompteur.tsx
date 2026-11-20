import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, StatusBar } from '../components/Chrome';
import { SETTINGS, SONG, SONG_KEY, SPEEDS } from '../lib/data';
import { KEY_FR, mod12, parseChordPro } from '../lib/music';
import { useStoredState } from '../lib/store';
import './Prompteur.css';

/** Auto-scroll rate at 1×, in px per ms (0.8 px every 30 ms in the prototype). */
const BASE_RATE = 0.8 / 30;

export default function Prompteur() {
  const [trans, setTrans] = useStoredState('stage.trans', 0);
  const [speed, setSpeed] = useStoredState('stage.speed', 2);
  const [playing, setPlaying] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pos = useRef(0);

  const lines = useMemo(() => parseChordPro(SONG, trans), [trans]);
  const fs = SETTINGS.stageFontSize;

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

  const page = useCallback((dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const top = Math.max(0, el.scrollTop + dir * el.clientHeight * 0.8);
    pos.current = top;
    el.scrollTo({ top, behavior: playing ? 'auto' : 'smooth' });
  }, [playing]);

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

  return (
    <Phone label="08 Scène" bg="#0f0e0d" column>
      <StatusBar stage />
      <div className="stage-head">
        <div className="stage-top">
          <Link to="/scene" className="stage-back">‹ Bar du Port · 3/9</Link>
          <div className="stage-pedal"><span />Pédalier connecté</div>
        </div>
        <div className="display stage-title">MINUIT SHUFFLE</div>
        <div className="stage-tags">
          <span className="stage-tag key"><span>Ton :</span><span>{KEY_FR[mod12(SONG_KEY + trans)]}</span></span>
          <span className="stage-tag">92 BPM · shuffle</span>
          <span className="stage-tag">Capo 0</span>
        </div>
      </div>

      <div className="lyrics" ref={scrollRef}>
        {lines.map((l, i) =>
          l.kind === 'section' ? (
            <div key={i} className="lyric-section">{l.label}</div>
          ) : (
            <div key={i} className="lyric-line">
              {l.segs.map((g, j) => (
                <div key={j} className="lyric-seg">
                  <span className="lyric-chord" style={{ fontSize: Math.round(fs * 0.82) }}>{g.chord}</span>
                  <span className="lyric-text" style={{ fontSize: fs }}>{g.text}</span>
                </div>
              ))}
            </div>
          ),
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
          <button className="page-btn" style={{ color: 'var(--muted-3)' }} onClick={() => page(-1)}>‹ Précédent</button>
          <button className={'play-btn' + (playing ? ' on' : '')} onClick={() => setPlaying(!playing)}>{playing ? 'PAUSE' : 'LECTURE'}</button>
          <button className="page-btn" onClick={() => page(1)}>Suivant ›</button>
        </div>
      </div>
    </Phone>
  );
}
