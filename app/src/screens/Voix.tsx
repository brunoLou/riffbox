import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { PitchRoll } from '../components/PitchRoll';
import { hzToMidi } from '../lib/pitch';
import { readStored, useStoredState } from '../lib/store';
import { useMicPitch } from '../lib/useMicPitch';
import {
  ACC_COLOR, MELODIES, TAKES_KEY, TOL, WARMUPS, accuracy, buildTimeline, noteFr, noteSci, readRange, tonicFor, voiceType,
  type Piece, type Take, type TracePoint,
} from '../lib/voice';
import './Voix.css';

const median = (a: number[]) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };

/** Shared microphone panel message (starting / refused / unavailable). */
export function MicMessage({ state, retry }: { state: string; retry: () => void }) {
  if (state === 'on') return null;
  return (
    <div className="mic-banner">
      {state === 'starting' ? 'Ouverture du micro…' : state === 'denied' ? 'Micro refusé : autorisez-le pour mesurer votre voix.' : 'Micro indisponible sur cet appareil.'}
      {state === 'denied' && <button className="mic-retry" onClick={retry}>Réessayer</button>}
    </div>
  );
}

/** Tolerance (± cents), saved; the screen owns the value so its display updates at once. */
export const useTolerance = () => useStoredState(TOL.key, TOL.def);

export function ToleranceStepper({ tol, setTol }: { tol: number; setTol: (n: number) => void }) {
  return (
    <div className="tol">
      <span>Zone juste</span>
      <div className="mini-stepper">
        <button onClick={() => setTol(Math.max(TOL.min, tol - TOL.step))} disabled={tol <= TOL.min} aria-label="Tolérance plus stricte">−</button>
        <span className="mono">±{tol} ct</span>
        <button onClick={() => setTol(Math.min(TOL.max, tol + TOL.step))} disabled={tol >= TOL.max} aria-label="Tolérance plus large">+</button>
      </div>
    </div>
  );
}

/* ---------- Hub: vocal tuner and free curve ---------- */

export default function Voix() {
  const nav = useNavigate();
  const [view, setView] = useStoredState<'note' | 'curve'>('voice.view', 'note');
  const [tol, setTol] = useTolerance();
  const [reading, setReading] = useState<{ midi: number; hz: number; cents: number } | null>(null);
  const [trace, setTrace] = useState<TracePoint[]>([]);
  const [now, setNow] = useState(0);
  const [center, setCenter] = useState(() => { const r = readRange(); return Math.round((r.low + r.high) / 2); });
  const recent = useRef<number[]>([]);
  const smooth = useRef<number | null>(null);
  const t0 = useRef<number | null>(null);
  const lastHeard = useRef(0);
  const traceRef = useRef<TracePoint[]>([]);
  const push = (p: TracePoint) => {
    const next = [...traceRef.current.filter(x => x.t > p.t - 12), p];
    traceRef.current = next;
    setTrace(next);
    // Follow the voice: recentre the staff when the recent pitch drifts away.
    const voiced = next.filter(x => x.m !== null && x.t > p.t - 2).map(x => x.m as number);
    if (voiced.length > 8) { const c = Math.round(median(voiced)); setCenter(cur => (Math.abs(c - cur) > 3 ? c : cur)); }
  };

  const mic = useMicPitch((hz, _lv, time) => {
    if (t0.current === null) t0.current = time;
    const t = time - t0.current;
    setNow(t);
    if (hz === null) {
      if (time - lastHeard.current > 0.4) { recent.current = []; smooth.current = null; setReading(null); }
      push({ t, m: null });
      return;
    }
    lastHeard.current = time;
    recent.current = [...recent.current.slice(-4), hz];
    const f = median(recent.current);
    const m = hzToMidi(f);
    const nearest = Math.round(m);
    const raw = (m - nearest) * 100;
    smooth.current = smooth.current === null || Math.abs(raw - smooth.current) > 40 ? raw : smooth.current + 0.45 * (raw - smooth.current);
    setReading({ midi: nearest, hz: f, cents: smooth.current });
    push({ t, m });
  });

  const r = readRange();
  const takes = readStored<Take[]>(TAKES_KEY, []);
  const acc = reading ? accuracy(reading.cents, tol) : null;
  const pos = reading ? Math.max(-50, Math.min(50, reading.cents)) : 0;

  return (
    <Phone label="10 Justesse vocale">
      <StatusBar />
      <div className="voice-scroll">
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/pratiquer" />
            <div className="head-titles">
              <span className="kicker">Pratiquer</span>
              <h1 className="display" style={{ fontSize: 28, whiteSpace: 'nowrap' }}>JUSTESSE VOCALE</h1>
            </div>
          </div>
        </div>

        <div className="seg" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
          <button className={view === 'note' ? 'on' : ''} onClick={() => setView('note')}>Note</button>
          <button className={view === 'curve' ? 'on' : ''} onClick={() => setView('curve')}>Courbe</button>
        </div>

        <MicMessage state={mic.state} retry={mic.retry} />

        {view === 'note' ? (
          <div className="vtuner">
            <div className="vtuner-note">
              <span className="vnote" style={{ color: acc ? ACC_COLOR[acc] : 'var(--muted)' }}>{reading ? noteFr(reading.midi) : '—'}</span>
              <div className="vnote-side">
                <span className="mono">{reading ? noteSci(reading.midi) : ''}</span>
                <span className="mono vhz">{reading ? `${reading.hz.toFixed(1)} Hz` : 'Chantez une note'}</span>
              </div>
            </div>
            <div className="cents-bar" aria-label={reading ? `${Math.round(reading.cents)} cents` : 'Pas de note'}>
              <div className="cents-zone" style={{ left: `${50 - tol}%`, width: `${tol * 2}%` }} />
              <div className="cents-mid" />
              <div className={'cents-mark' + (reading ? '' : ' idle')} style={{ left: `${50 + pos}%`, background: acc ? ACC_COLOR[acc] : undefined }} />
              <span className="cents-lbl l">−50</span><span className="cents-lbl r">+50</span>
            </div>
            <div className="vtuner-foot">
              <span className="mono vcents" style={{ color: acc ? ACC_COLOR[acc] : 'var(--muted)' }}>
                {reading ? `${reading.cents > 0 ? '+' : ''}${Math.round(reading.cents)} ct` : '— ct'}
              </span>
              <span className={'vjuste' + (acc === 'good' ? ' on' : '')}><span />JUSTE</span>
            </div>
          </div>
        ) : (
          <PitchRoll lo={center - 7} hi={center + 7} height={300} window={8} now={now} trace={trace} tol={tol} />
        )}

        <ToleranceStepper tol={tol} setTol={setTol} />

        <nav className="voice-menu" aria-label="Exercices de voix">
          <button onClick={() => nav('/voix/exercices')}><b>Échauffements</b><span>{WARMUPS.length} exercices · sirènes, gammes, intervalles</span><i>›</i></button>
          <button onClick={() => nav('/voix/melodies')}><b>Chanter sur la mélodie</b><span>Score par phrase</span><i>›</i></button>
          <button onClick={() => nav('/voix/prises')}><b>Mes prises</b><span>{takes.length ? `${takes.length} enregistrement${takes.length > 1 ? 's' : ''} avec courbe` : 'Aucune pour l’instant'}</span><i>›</i></button>
          <button onClick={() => nav('/voix/tessiture')}><b>Ma tessiture</b><span>{r.measured ? `${noteFr(r.low)} – ${noteFr(r.high)} · ${voiceType(r)}` : 'À mesurer'}</span><i>›</i></button>
          <button onClick={() => nav('/outils/capo')}><b>Calculateur de capodastre</b><span>Jouer dans n’importe quel ton</span><i>›</i></button>
        </nav>
      </div>
      <TabBar active={2} />
    </Phone>
  );
}

/* ---------- Lists ---------- */

function pieceRange(p: Piece) {
  const tl = buildTimeline(p, tonicFor(p, readRange()));
  const ms = tl.targets.flatMap(t => [t.midi, t.to ?? t.midi]);
  return `${noteFr(Math.min(...ms))} → ${noteFr(Math.max(...ms))}`;
}

export function VoixListe({ kind }: { kind: 'warmup' | 'melody' }) {
  const nav = useNavigate();
  const list = kind === 'warmup' ? WARMUPS : MELODIES;
  const r = readRange();
  return (
    <Phone label={kind === 'warmup' ? '10b Échauffements' : '10c Mélodies'}>
      <StatusBar />
      <div className="voice-scroll">
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/voix" />
            <div className="head-titles">
              <span className="kicker">Justesse vocale</span>
              <h1 className="display" style={{ fontSize: 28, whiteSpace: 'nowrap' }}>{kind === 'warmup' ? 'ÉCHAUFFEMENTS' : 'MÉLODIES'}</h1>
            </div>
          </div>
        </div>
        <p className="voice-note">
          {r.measured ? `Placés dans votre tessiture (${noteFr(r.low)} – ${noteFr(r.high)}).` : 'Placés dans une tessiture moyenne. Mesurez la vôtre pour des exercices à votre hauteur.'}
          {kind === 'warmup' ? ' Chaque reprise monte d’un demi-ton.' : ' Un guide sonore joue la mélodie : utilisez des écouteurs.'}
        </p>
        {!r.measured && <button className="btn-outline" onClick={() => nav('/voix/tessiture')}>Mesurer ma tessiture ›</button>}
        <div className={kind === 'warmup' ? 'ex-grid' : 'ex-list'}>
          {list.map(p => (
            <button key={p.id} className={'ex-card' + (kind === 'melody' ? ' wide' : '')} onClick={() => nav(`/voix/ex/${p.id}`)}>
              <span className="ex-title">{p.title}</span>
              <span className="ex-sub">{p.sub}</span>
              <span className="ex-range mono">{pieceRange(p)} · {p.bpm} BPM</span>
            </button>
          ))}
        </div>
      </div>
      <TabBar active={2} />
    </Phone>
  );
}

export function VoixPrises() {
  const nav = useNavigate();
  const [takes, setTakes] = useStoredState<Take[]>(TAKES_KEY, []);
  return (
    <Phone label="10d Prises">
      <StatusBar />
      <div className="voice-scroll">
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/voix" />
            <div className="head-titles">
              <span className="kicker">Justesse vocale</span>
              <h1 className="display" style={{ fontSize: 28 }}>MES PRISES</h1>
            </div>
          </div>
        </div>
        {!takes.length && <div className="songs-empty">Vos enregistrements apparaîtront ici après un exercice ou une mélodie.</div>}
        {takes.map(t => (
          <div key={t.id} className="take-row">
            <button className="take-main" onClick={() => nav(`/voix/prise/${t.id}`)}>
              <span className="take-score mono" style={{ color: ACC_COLOR[t.score >= 75 ? 'good' : t.score >= 50 ? 'close' : 'off'] }}>{t.score}</span>
              <span className="song-text">
                <span className="song-title">{t.title}</span>
                <span className="song-meta">{new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(t.date)} · ±{t.tol} ct</span>
              </span>
            </button>
            <button className="take-del" aria-label={`Supprimer la prise ${t.title}`} onClick={() => {
              if (!window.confirm('Supprimer cette prise ?')) return;
              setTakes(takes.filter(x => x.id !== t.id));
              void import('../lib/blobs').then(b => b.deleteBlob(t.id));
            }}>✕</button>
          </div>
        ))}
      </div>
      <TabBar active={2} />
    </Phone>
  );
}
