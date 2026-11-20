import { useEffect, useState } from 'react';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { PRESETS } from '../lib/data';
import { FR, SHARP } from '../lib/music';
import { useStoredState } from '../lib/store';
import './Accordeur.css';

const TICKS: { c: number; h: string; col: string }[] = [];
for (let c = -50; c <= 50; c += 5) {
  TICKS.push({ c, h: c % 25 === 0 ? '24px' : c % 10 === 0 ? '14px' : '9px', col: Math.abs(c) <= 5 ? '#2f8a55' : '#5a4a36' });
}
const sharpToGlyph = (s: string) => s.replace('#', '♯');

export default function Accordeur() {
  const [auto, setAuto] = useStoredState('tuner.auto', true);
  const [preset, setPreset] = useStoredState('tuner.preset', 0);
  const [str, setStr] = useState(1);
  const [cents, setCents] = useState(-18);

  // Simulated pitch detection: the needle settles toward 0 with some jitter.
  useEffect(() => {
    const t = setInterval(() => {
      setCents(s => {
        const noise = (Math.random() - 0.5) * (Math.abs(s) < 4 ? 1.6 : 4);
        let c = s * 0.86 + noise;
        if (Math.random() < 0.015) c = (Math.random() - 0.5) * 60;
        return Math.max(-50, Math.min(50, c));
      });
    }, 160);
    return () => clearInterval(t);
  }, []);

  const pr = PRESETS[preset];
  const midi = pr.m[str];
  const rc = Math.round(cents);
  const inTune = Math.abs(rc) <= 3;
  const hz = (440 * Math.pow(2, (midi - 69 + cents / 100) / 12)).toFixed(1);

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
            <div className="needle" style={{ transform: `rotate(${cents * 0.9}deg)` }} />
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
            <span className="mono readout-hz">{hz} Hz</span>
            <span className="mono readout-cents" style={{ color: inTune ? 'var(--led)' : 'var(--amber)' }}>{(rc > 0 ? '+' : '') + rc} ct</span>
          </div>
        </div>

        <div className="string-row">
          {pr.m.map((m, i) => (
            <button
              key={i}
              className={'chip string-btn' + (i === str ? ' on-amber' : '')}
              onClick={() => { setStr(i); setCents((Math.random() > 0.5 ? 1 : -1) * (15 + Math.random() * 30)); }}
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
              <button key={x.label} className={'chip preset' + (i === preset ? ' on-cream' : '')} onClick={() => { setPreset(i); setCents(-25); }}>
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
