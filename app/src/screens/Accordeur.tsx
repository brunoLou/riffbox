import { useEffect, useRef, useState } from 'react';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { PRESETS } from '../lib/data';
import { FR, SHARP } from '../lib/music';
import { hzToMidi, startPitch, type PitchTracker } from '../lib/pitch';
import { useStoredState } from '../lib/store';
import './Accordeur.css';

const TICKS: { c: number; h: string; col: string }[] = [];
for (let c = -50; c <= 50; c += 5) {
  TICKS.push({ c, h: c % 25 === 0 ? '24px' : c % 10 === 0 ? '14px' : '9px', col: Math.abs(c) <= 5 ? '#2f8a55' : '#5a4a36' });
}
const sharpToGlyph = (s: string) => s.replace('#', '♯');

type Mic = 'starting' | 'on' | 'denied' | 'unsupported';

/** How long without a pitch before the needle is released. */
const HOLD_MS = 450;
const median = (a: number[]) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };

export default function Accordeur() {
  const [auto, setAuto] = useStoredState('tuner.auto', true);
  const [preset, setPreset] = useStoredState('tuner.preset', 0);
  const [str, setStr] = useStoredState('tuner.string', 1);
  const [mic, setMic] = useState<Mic>('starting');
  const [reading, setReading] = useState<{ hz: number; cents: number } | null>(null);
  const [attempt, setAttempt] = useState(0);

  const pr = PRESETS[preset];
  // Latest settings for the audio callback.
  const cfg = useRef({ auto, str, pr });
  cfg.current = { auto, str, pr };
  const recent = useRef<number[]>([]);
  const lastHeard = useRef(0);
  const smooth = useRef<number | null>(null);

  // Live pitch from the microphone. Released when the screen is hidden or left.
  useEffect(() => {
    let tracker: PitchTracker | null = null;
    let cancelled = false;
    const onPitch = (hz: number | null) => {
      const now = performance.now();
      if (hz === null) {
        if (now - lastHeard.current > HOLD_MS) { recent.current = []; smooth.current = null; setReading(null); }
        return;
      }
      lastHeard.current = now;
      recent.current = [...recent.current.slice(-4), hz];
      const f = median(recent.current);
      const m = hzToMidi(f);
      const { auto: isAuto, str: s, pr: p } = cfg.current;
      let target = p.m[s];
      if (isAuto) {
        let best = 0;
        p.m.forEach((n, i) => { if (Math.abs(n - m) < Math.abs(p.m[best] - m)) best = i; });
        target = p.m[best];
        if (best !== s) { setStr(best); smooth.current = null; }
      }
      const raw = (m - target) * 100;
      smooth.current = smooth.current === null ? raw : smooth.current + 0.4 * (raw - smooth.current);
      setReading({ hz: f, cents: smooth.current });
    };
    const start = async () => {
      setMic('starting');
      try {
        const t = await startPitch(onPitch);
        if (cancelled) { t.stop(); return; }
        tracker = t;
        setMic('on');
      } catch (e) {
        if (!cancelled) setMic((e as Error).message === 'unsupported' ? 'unsupported' : 'denied');
      }
    };
    const onVis = () => {
      if (document.hidden) { tracker?.stop(); tracker = null; setReading(null); }
      else if (!tracker) void start();
    };
    void start();
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelled = true; tracker?.stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [attempt, setStr]);

  const midi = pr.m[str];
  const cents = reading?.cents ?? 0;
  const rc = Math.round(cents);
  const inTune = !!reading && Math.abs(rc) <= 3;
  const needle = Math.max(-50, Math.min(50, cents));

  return (
    <Phone label="02 Accordeur">
      <StatusBar />
      <div className="screen-body" style={{ gap: 18 }}>
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/" />
            <span className="display" style={{ fontSize: 32 }}>ACCORDEUR</span>
          </div>
          <button className="auto-toggle" onClick={() => setAuto(!auto)} aria-pressed={auto}>
            <span>Auto</span>
            <span className={'switch' + (auto ? ' on' : '')}><span /></span>
          </button>
        </div>

        <div className="tuner-case">
          <div className="tuner-face">
            {TICKS.map(k => (
              <div key={k.c} className="tick" style={{ transform: `rotate(${k.c * 0.9}deg)` }}>
                <div style={{ height: k.h, background: k.col }} />
              </div>
            ))}
            <div className="face-lbl" style={{ left: 22, top: 52 }}>−50</div>
            <div className="face-lbl face-zero">0</div>
            <div className="face-lbl" style={{ right: 22, top: 52 }}>+50</div>
            <div className="face-cents">CENTS</div>
            <div className={'needle' + (reading ? '' : ' idle')} style={{ transform: `rotate(${needle * 0.9}deg)` }} />
            <div className="hub" />
          </div>
          <div className="tuner-foot">
            <span className="tuner-brand">RIFFBOX · TUNER</span>
            <div className="tuner-ok">
              <span style={{ color: inTune ? 'var(--led)' : '#7a6a55' }}>JUSTE</span>
              <span className={'led' + (inTune ? ' on' : '')} style={{ width: 12, height: 12, boxShadow: inTune ? '0 0 12px var(--led)' : undefined }} />
            </div>
          </div>
        </div>

        <div className="readout">
          <div className="readout-note">
            <span className="note-big">{sharpToGlyph(SHARP[midi % 12])}</span>
            <span className="note-oct">{Math.floor(midi / 12) - 1}</span>
          </div>
          <div className="readout-info">
            <span className="readout-fr">{FR[midi % 12]} · corde {6 - str}</span>
            {mic === 'on' ? (
              <>
                <span className="mono readout-hz">{reading ? `${reading.hz.toFixed(1)} Hz` : 'Jouez une corde'}</span>
                <span className="mono readout-cents" style={{ color: !reading ? 'var(--muted)' : inTune ? 'var(--led-text)' : 'var(--accent-text)' }}>
                  {!reading ? '— ct' : `${rc > 0 ? '+' : ''}${rc} ct${Math.abs(rc) > 50 ? (rc > 0 ? ' ↓' : ' ↑') : ''}`}
                </span>
              </>
            ) : mic === 'starting' ? (
              <span className="mono readout-hz">Micro…</span>
            ) : (
              <>
                <span className="mic-msg">{mic === 'denied' ? 'Micro refusé' : 'Micro indisponible'}</span>
                {mic === 'denied' && <button className="mic-retry" onClick={() => setAttempt(a => a + 1)}>Réessayer</button>}
              </>
            )}
          </div>
        </div>

        <div className="string-row">
          {pr.m.map((m, i) => (
            <button
              key={i}
              className={'chip string-btn' + (i === str ? ' on-amber' : '')}
              onClick={() => { setStr(i); setAuto(false); smooth.current = null; }}
              aria-pressed={i === str}
            >
              <span className="string-n">{sharpToGlyph(SHARP[m % 12])}</span>
              <span className="string-num">{6 - i}</span>
            </button>
          ))}
        </div>

        <div className="presets">
          <span className="kicker" style={{ padding: '0 4px' }}>Accordage</span>
          <div className="hscroll" style={{ gap: 8 }}>
            {PRESETS.map((x, i) => (
              <button key={x.label} className={'chip preset' + (i === preset ? ' on-cream' : '')} onClick={() => { setPreset(i); smooth.current = null; }}>
                {x.label}
              </button>
            ))}
            <button className="chip preset preset-add">+ Perso</button>
          </div>
        </div>
      </div>
      <TabBar active={0} />
    </Phone>
  );
}
