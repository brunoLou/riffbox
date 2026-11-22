import { useEffect, useRef, useState } from 'react';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { BPM_RANGE, TRACKS, buildBacking, chordLabel, trackKey, type Track } from '../lib/backing';
import { MetronomeEngine, type Pattern } from '../lib/metronome';
import { mod12 } from '../lib/music';
import { usePedal } from '../lib/pedal';
import { useStoredState } from '../lib/store';
import './Backing.css';
import { markUsed } from '../lib/usage';

const STYLES = ['Tous', 'Blues', 'Rock', 'Funk'] as const;
type Tweaks = Record<string, { key: number; bpm: number }>;

export default function Backing() {
  const [style, setStyle] = useStoredState<(typeof STYLES)[number]>('backing.style', 'Tous');
  const [selId, setSelId] = useStoredState<string | null>('backing.sel', null);
  const [tweaks, setTweaks] = useStoredState<Tweaks>('backing.tweaks', {});
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState({ bar: 0, beat: -1 });

  const sel = TRACKS.find(t => t.id === selId) ?? null;
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
    const e = engine.current!;
    if (sel?.id === t.id && playing) { e.stop(); setPlaying(false); return; }
    if (sel?.id !== t.id) { setSelId(t.id); live.current = { t, ...tw(t) }; e.rewind(); setPos({ bar: 0, beat: -1 }); }
    if (!e.running) e.start();
    markUsed('backing');
    setPlaying(true);
  };
  const stop = () => { engine.current!.stop(); setPlaying(false); setPos({ bar: 0, beat: -1 }); };
  const close = () => { stop(); setSelId(null); };
  const tweak = (d: { key?: number; bpm?: number }) => {
    if (!sel) return;
    const cur = tw(sel);
    setTweaks({ ...tweaks, [sel.id]: { key: d.key ?? cur.key, bpm: Math.max(BPM_RANGE[0], Math.min(BPM_RANGE[1], d.bpm ?? cur.bpm)) } });
  };

  const shown = TRACKS.filter(t => style === 'Tous' || t.style === style);

  // Pedal: play / pause the open track (or the first one shown), or start again from bar 1.
  const pedalPlay = () => { const t = sel ?? shown[0]; if (t) play(t); };
  usePedal({
    right: pedalPlay,
    middle: pedalPlay,
    left: () => { if (sel) { engine.current!.rewind(); setPos({ bar: 0, beat: -1 }); } },
  });
  const cur = sel ? tw(sel) : null;
  const bars = sel?.bars ?? [];

  return (
    <Phone label="07 Backing tracks">
      <StatusBar />
      <div className={'backing-scroll' + (sel ? ' with-player' : '')}>
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/pratiquer" />
            <div className="head-titles">
              <span className="kicker">Pratiquer</span>
              <h1 className="display" style={{ fontSize: 28, whiteSpace: 'nowrap' }}>BACKING TRACKS</h1>
            </div>
          </div>
        </div>

        <div className="seg" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
          {STYLES.map(s => <button key={s} className={s === style ? 'on' : ''} onClick={() => setStyle(s)}>{s}</button>)}
        </div>

        {shown.map(t => {
          const v = tw(t);
          const isSel = sel?.id === t.id, isPlaying = isSel && playing;
          return (
            <div key={t.id} className={'track' + (isSel ? ' sel' : '')}>
              <button className={'track-play' + (isPlaying ? ' on' : '')} onClick={() => play(t)} aria-label={isPlaying ? `Pause ${t.name}` : `Lire ${t.name}`}>
                {isPlaying ? '❚❚' : '▶'}
              </button>
              <div className="track-text">
                <span className="track-name">{t.name}</span>
                <span className="track-form">{t.form}</span>
              </div>
              <div className="track-tags">
                <span className="tag key">{trackKey(v.key, t.minor)}</span>
                <span className="track-bpm mono">{v.bpm} BPM</span>
              </div>
            </div>
          );
        })}
      </div>

      {sel && cur && (
        <div className="player" role="region" aria-label="Lecteur">
          <div className="player-head">
            <span className="player-kicker"><span className={'led' + (playing ? ' on' : '')} style={{ width: 8, height: 8 }} />{playing ? 'En lecture' : 'En pause'} · {sel.name}</span>
            <button className="player-close" onClick={close} aria-label="Fermer le lecteur">✕</button>
          </div>

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
        </div>
      )}
      <TabBar active={2} />
    </Phone>
  );
}
