import { useEffect, useRef, useState } from 'react';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { TempoKnob } from '../components/TempoKnob';
import {
  DEFAULT_GAP, DEFAULT_SPEED, GROOVES, MetronomeEngine, SIGNATURES, SUBDIVISIONS, buildPattern, defaultAccents, isSilentBar, trainerBpm,
  type GapTrainer, type GrooveId, type Signature, type SpeedTrainer,
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

  const [speedT, setSpeedT] = useStoredState<SpeedTrainer>('metro.trainer', DEFAULT_SPEED);
  const [gapT, setGapT] = useStoredState<GapTrainer>('metro.gap', DEFAULT_GAP);
  /** The bar being heard (from 1), and whether it is a silent one. */
  const [barNow, setBarNow] = useState<{ n: number; silent: boolean } | null>(null);

  // The engine reads the latest settings on every step, so changes apply live.
  const settings = useRef({ bpm, sig, sub, accents, groove });
  settings.current = { bpm, sig, sub, accents, groove };
  /** `sched`: the tempo the speed trainer set for the bar being scheduled (null: the knob's). */
  const trainers = useRef<{ speedT: SpeedTrainer; gapT: GapTrainer; start: number; sched: number | null }>({ speedT, gapT, start: bpm, sched: null });
  trainers.current = { ...trainers.current, speedT, gapT };
  const engine = useRef<MetronomeEngine | null>(null);
  if (!engine.current) {
    engine.current = new MetronomeEngine(() => {
      const t = trainers.current;
      return buildPattern(t.speedT.on && t.sched !== null ? { ...settings.current, bpm: t.sched } : settings.current);
    }, (b, _bar, count) => {
      setBeat(b);
      if (b === 0) setBarNow({ n: count, silent: isSilentBar(trainers.current.gapT, count) });
    }, {
      // The speed trainer sets each bar's tempo as it is scheduled.
      onBar: count => {
        const t = trainers.current;
        t.sched = t.speedT.on ? trainerBpm(t.start, t.speedT, count) : null;
      },
      muted: count => isSilentBar(trainers.current.gapT, count),
    });
  }
  useEffect(() => () => engine.current?.dispose(), []);
  // The tempo reached shows on the knob while the trainer runs.
  useEffect(() => {
    if (playing && speedT.on && barNow) setBpm(trainerBpm(trainers.current.start, speedT, barNow.n));
  }, [barNow?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = () => {
    if (playing) {
      engine.current!.stop(); setBeat(null); setBarNow(null);
      // Back to the starting tempo, ready for the next run.
      if (speedT.on) setBpm(trainers.current.start);
    } else {
      trainers.current.start = bpm;
      trainers.current.sched = null;
      engine.current!.start(); markUsed('metro');
    }
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

        <Trainer speed={speedT} gap={gapT} bpm={playing && speedT.on ? trainers.current.start : bpm}
          onSpeed={setSpeedT} onGap={setGapT} running={playing} bar={barNow} />
      </div>

      <button className={'cta' + (playing ? ' on' : '')} onClick={toggle}>
        {playing ? 'Arrêter' : `▶  Lecture · ${bpm} BPM${groove === 'clic' ? '' : ' · ' + grooveDef.name.toLowerCase()}`}
      </button>
      <TabBar active={0} />
    </Phone>
  );
}

const pick = (label: string, value: number, options: number[], set: (v: number) => void, unit = '') => (
  <select aria-label={label} value={value} onChange={e => set(Number(e.target.value))}>
    {options.map(o => <option key={o} value={o}>{o}{unit}</option>)}
  </select>
);

/** Speed trainer (the tempo rises bar after bar) and silent bars (keep the tempo alone). */
function Trainer({ speed, gap, bpm, onSpeed, onGap, running, bar }: {
  speed: SpeedTrainer; gap: GapTrainer; bpm: number; running: boolean; bar: { n: number; silent: boolean } | null;
  onSpeed: (t: SpeedTrainer) => void; onGap: (g: GapTrainer) => void;
}) {
  return (
    <section className="trainer" aria-label="Entraîneur">
      <span className="kicker">Entraîneur</span>
      <label className="trainer-row">
        <input type="checkbox" checked={speed.on} onChange={e => onSpeed({ ...speed, on: e.target.checked, to: Math.max(speed.to, bpm + speed.step) })} />
        <span className="trainer-name">Tempo qui monte</span>
      </label>
      {speed.on && (
        <p className="trainer-set">
          +{pick('Hausse du tempo', speed.step, [1, 2, 4, 5, 10], v => onSpeed({ ...speed, step: v }), ' BPM')} toutes les
          {' '}{pick('Toutes les combien de mesures', speed.every, [1, 2, 4, 8, 16], v => onSpeed({ ...speed, every: v }))} mesures, de {bpm} jusqu’à
          {' '}{pick('Tempo à atteindre', speed.to, Array.from({ length: 41 }, (_, i) => 40 + i * 5).filter(v => v > bpm), v => onSpeed({ ...speed, to: v }), ' BPM')}
        </p>
      )}
      <label className="trainer-row">
        <input type="checkbox" checked={gap.on} onChange={e => onGap({ ...gap, on: e.target.checked })} />
        <span className="trainer-name">Mesures muettes</span>
      </label>
      {gap.on && (
        <p className="trainer-set">
          Jouer {pick('Mesures jouées', gap.play, [1, 2, 4, 8], v => onGap({ ...gap, play: v }))} mesures, puis couper
          {' '}{pick('Nombre de mesures muettes', gap.mute, [1, 2, 4], v => onGap({ ...gap, mute: v }))} : gardez le tempo seul, le clic doit retomber juste.
        </p>
      )}
      {running && bar && (speed.on || gap.on) && (
        <p className={'trainer-now' + (bar.silent ? ' silent' : '')} role="status">
          Mesure {bar.n}{bar.silent ? ' · silence, tenez le tempo !' : ''}
        </p>
      )}
    </section>
  );
}
