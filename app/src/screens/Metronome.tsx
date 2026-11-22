import { useEffect, useRef, useState } from 'react';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { TempoKnob } from '../components/TempoKnob';
import {
  GROOVES, MetronomeEngine, SIGNATURES, SUBDIVISIONS, buildPattern, defaultAccents,
  type GrooveId, type Signature,
} from '../lib/metronome';
import { usePedal } from '../lib/pedal';
import { useStoredState } from '../lib/store';
import './Metronome.css';
import { markUsed } from '../lib/usage';

export const BPM_MIN = 40, BPM_MAX = 240;

export default function Metronome() {
  const [bpm, setBpm] = useStoredState('metro.bpm', 92);
  const [sig, setSig] = useStoredState<Signature>('metro.sig', '4/4');
  const [sub, setSub] = useStoredState('metro.sub', 1);
  const [accents, setAccents] = useStoredState('metro.accents', defaultAccents('4/4'));
  const [groove, setGroove] = useStoredState<GrooveId>('metro.groove', 'clic');
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState<number | null>(null);
  const [tapFlash, setTapFlash] = useState(false);
  const taps = useRef<number[]>([]);

  // The engine reads the latest settings on every step, so changes apply live.
  const settings = useRef({ bpm, sig, sub, accents, groove });
  settings.current = { bpm, sig, sub, accents, groove };
  const engine = useRef<MetronomeEngine | null>(null);
  if (!engine.current) engine.current = new MetronomeEngine(() => buildPattern(settings.current), setBeat);
  useEffect(() => () => engine.current?.dispose(), []);

  const toggle = () => {
    if (playing) { engine.current!.stop(); setBeat(null); } else { engine.current!.start(); markUsed('metro'); }
    setPlaying(!playing);
  };

  const pickSig = (s: Signature) => { setSig(s); setAccents(defaultAccents(s)); if (s !== '4/4') setGroove('clic'); };
  const pickGroove = (g: GrooveId) => { setGroove(g); if (g !== 'clic' && sig !== '4/4') { setSig('4/4'); setAccents(defaultAccents('4/4')); } };

  const tap = () => {
    const now = performance.now();
    const t = taps.current.filter(x => now - x < 2000).concat(now).slice(-5);
    taps.current = t;
    if (t.length >= 2) {
      const avg = (t[t.length - 1] - t[0]) / (t.length - 1);
      setBpm(Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(60000 / avg))));
    }
    setTapFlash(true);
    window.setTimeout(() => setTapFlash(false), 120);
  };

  usePedal({ right: toggle, left: tap, middle: toggle });

  const subLocked = groove !== 'clic' || sig === '6/8';
  const grooveDef = GROOVES.find(g => g.id === groove)!;

  return (
    <Phone label="03 Métronome">
      <StatusBar />
      <div className="screen-body" style={{ gap: 14 }}>
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/" />
            <h1 className="display" style={{ fontSize: 32 }}>MÉTRONOME</h1>
          </div>
          <span className="metro-sig mono">{sig}</span>
        </div>

        <div className="beats" aria-label="Temps de la mesure — touchez pour accentuer">
          {accents.map((a, i) => (
            <button
              key={i}
              className={'beat-lamp' + (a ? ' accent' : '') + (beat === i ? ' lit' : '')}
              onClick={() => setAccents(accents.map((x, j) => (j === i ? !x : x)))}
              aria-pressed={a}
              aria-label={`Temps ${i + 1}${a ? ', accentué' : ''}`}
            >{i + 1}</button>
          ))}
        </div>

        <div className="knob-row">
          <button className="nudge" onClick={() => setBpm(Math.max(BPM_MIN, bpm - 1))} aria-label="Moins 1 BPM">−</button>
          <TempoKnob value={bpm} min={BPM_MIN} max={BPM_MAX} onChange={setBpm} />
          <button className="nudge" onClick={() => setBpm(Math.min(BPM_MAX, bpm + 1))} aria-label="Plus 1 BPM">+</button>
        </div>

        <button className={'tap' + (tapFlash ? ' hit' : '')} onPointerDown={tap} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(); } }}>
          <span className="tap-switch" />TAP TEMPO
        </button>

        <div className="sigs">
          {SIGNATURES.map(s => (
            <button key={s} className={'chip sig-chip' + (s === sig ? ' on-cream' : '')} onClick={() => pickSig(s)}>{s}</button>
          ))}
        </div>

        <div className={'seg' + (subLocked ? ' locked' : '')} style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
          {SUBDIVISIONS.map(d => (
            <button key={d.n} className={!subLocked && d.n === sub ? 'on' : ''} disabled={subLocked} onClick={() => setSub(d.n)}>{d.label}</button>
          ))}
        </div>

        <div className="grooves">
          {GROOVES.map(g => (
            <button key={g.id} className={'groove' + (g.id === groove ? ' on' : '')} onClick={() => pickGroove(g.id)}>
              <span className={'led groove-led' + (g.id === groove ? ' on' : '')} />
              <span className="groove-name">{g.name}</span>
              <span className="groove-sub">{g.sub}</span>
            </button>
          ))}
        </div>
      </div>

      <button className={'cta' + (playing ? ' on' : '')} onClick={toggle}>
        {playing ? 'Arrêter' : `▶  Lecture · ${bpm} BPM${groove === 'clic' ? '' : ' · ' + grooveDef.name.toLowerCase()}`}
      </button>
      <TabBar active={0} />
    </Phone>
  );
}
