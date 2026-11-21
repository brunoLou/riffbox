import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { PitchRoll } from '../components/PitchRoll';
import { deleteBlob, getBlob, putBlob } from '../lib/blobs';
import { hzToMidi, startPitch, type PitchTracker } from '../lib/pitch';
import { readStored, useStoredState, writeStored } from '../lib/store';
import {
  ACC_COLOR, MAX_TAKES, TAKES_KEY, average, buildTimeline, compactTrace, noteFr, pieceById, readRange, scorePhrases,
  targetAt, tonicFor, type Piece, type Take, type Timeline, type TracePoint,
} from '../lib/voice';
import { MicMessage, ToleranceStepper, useTolerance } from './Voix';
import './Voix.css';

/** Analysis window delay of the pitch tracker, in seconds. */
const LATENCY = 0.04;
const scoreColor = (s: number) => ACC_COLOR[s >= 75 ? 'good' : s >= 50 ? 'close' : 'off'];
const verdict = (s: number) => (s >= 85 ? 'Très juste !' : s >= 70 ? 'Bien chanté' : s >= 50 ? 'Presque : encore un essai' : 'À retravailler');

function rollRange(tl: Timeline) {
  const ms = tl.targets.flatMap(t => [t.midi, t.to ?? t.midi]);
  return { lo: Math.min(...ms) - 3, hi: Math.max(...ms) + 3 };
}

function PhraseChips({ tl, scores }: { tl: Timeline; scores: (number | null)[] }) {
  return (
    <div className="phrase-chips">
      {tl.phrases.map((p, i) => (
        <span key={i} className="phrase-chip" title={p.label} style={{ borderColor: scores[i] != null ? scoreColor(scores[i]!) : undefined }}>
          <span className="mono">P{i + 1}</span>
          <b style={{ color: scores[i] != null ? scoreColor(scores[i]!) : undefined }}>{scores[i] ?? '–'}</b>
        </span>
      ))}
    </div>
  );
}

/** Guide tone: soft sine + triangle; glides ramp the frequency. */
function scheduleGuide(ctx: AudioContext, tl: Timeline, t0: number) {
  const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);
  const out = ctx.createGain();
  out.gain.value = 0.18;
  out.connect(ctx.destination);
  for (const n of tl.targets) {
    const a = t0 + n.t0, b = a + n.dur * 0.95;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, a);
    g.gain.exponentialRampToValueAtTime(1, a + 0.03);
    g.gain.setValueAtTime(1, b - 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, b);
    g.connect(out);
    (['sine', 'triangle'] as OscillatorType[]).forEach((type, k) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(hz(n.midi), a);
      if (n.to !== undefined) o.frequency.linearRampToValueAtTime(hz(n.to), a + n.dur);
      const v = ctx.createGain(); v.gain.value = k ? 0.35 : 0.65;
      o.connect(v); v.connect(g);
      o.start(a); o.stop(b + 0.02);
    });
  }
  return out;
}

function scheduleCountIn(ctx: AudioContext, t0: number, beat: number) {
  for (let i = 0; i < 4; i++) {
    const t = t0 - (4 - i) * beat;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'square'; o.frequency.value = i === 0 ? 1600 : 1100;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.06);
  }
}

/* ---------- Exercise / melody player ---------- */

export function VoixExercice() {
  const { pieceId = '' } = useParams();
  const piece = pieceById(pieceId);
  if (!piece) return <Navigate to="/voix" replace />;
  return <Session key={pieceId} piece={piece} />;
}

type Phase = 'ready' | 'countin' | 'running' | 'saving' | 'error';

function Session({ piece }: { piece: Piece }) {
  const nav = useNavigate();
  const [tol, setTol] = useTolerance();
  const [guide, setGuide] = useStoredState('voice.guide', true);
  const tl = useMemo(() => buildTimeline(piece, tonicFor(piece, readRange())), [piece]);
  const { lo, hi } = rollRange(tl);
  const [phase, setPhase] = useState<Phase>('ready');
  const [now, setNow] = useState(-1);
  const [trace, setTrace] = useState<TracePoint[]>([]);
  const [scores, setScores] = useState<(number | null)[]>(() => tl.phrases.map(() => null));
  const [micError, setMicError] = useState<string | null>(null);
  const run = useRef<{ tracker: PitchTracker; rec: MediaRecorder | null; chunks: Blob[]; t0: number; recStart: number; raf: number; trace: TracePoint[]; done: boolean; guide?: GainNode } | null>(null);

  const stopAll = () => {
    const r = run.current;
    if (!r) return;
    cancelAnimationFrame(r.raf);
    r.guide?.disconnect();
    if (r.rec && r.rec.state !== 'inactive') { r.rec.onstop = null; r.rec.stop(); }
    r.tracker.stop();
    run.current = null;
  };
  useEffect(() => stopAll, []);

  const finish = () => {
    const r = run.current;
    if (!r || r.done) return;
    r.done = true;
    cancelAnimationFrame(r.raf);
    setPhase('saving');
    const final = scorePhrases(tl, r.trace, tol);
    const save = async (blob: Blob | null) => {
      r.tracker.stop();
      run.current = null;
      const id = 'take' + Date.now();
      const hasAudio = blob ? await putBlob(id, blob) : false;
      const take: Take = {
        id, pieceId: piece.id, title: piece.title, date: Date.now(), tol, tonic: tl.tonic,
        score: average(final), phrases: final, trace: compactTrace(r.trace), hasAudio, audioOffset: r.t0 - r.recStart,
      };
      const all = [take, ...readStored<Take[]>(TAKES_KEY, [])];
      all.slice(MAX_TAKES).forEach(t => void deleteBlob(t.id));
      writeStored(TAKES_KEY, all.slice(0, MAX_TAKES));
      nav(`/voix/prise/${id}`, { replace: true, state: { fresh: true } });
    };
    if (r.rec && r.rec.state !== 'inactive') {
      r.rec.onstop = () => void save(new Blob(r.chunks, { type: r.rec!.mimeType || 'audio/webm' }));
      r.rec.stop();
    } else void save(null);
  };

  const start = async () => {
    setMicError(null);
    setTrace([]); setScores(tl.phrases.map(() => null));
    let tracker: PitchTracker;
    try {
      tracker = await startPitch((hz, _lv, time) => {
        const r = run.current;
        if (!r) return;
        const t = time - LATENCY - r.t0;
        if (t < -0.3) return;
        r.trace.push({ t, m: hz === null ? null : hzToMidi(hz) });
        setTrace([...r.trace]);
      });
    } catch (e) {
      setMicError((e as Error).message === 'unsupported' ? 'unsupported' : 'denied');
      setPhase('error');
      return;
    }
    const ctx = tracker.ctx;
    let rec: MediaRecorder | null = null;
    const chunks: Blob[] = [];
    try { rec = new MediaRecorder(tracker.stream); rec.ondataavailable = e => e.data.size && chunks.push(e.data); rec.start(); } catch { rec = null; }
    const recStart = ctx.currentTime;
    const t0 = ctx.currentTime + 0.4 + 4 * tl.beat;
    scheduleCountIn(ctx, t0, tl.beat);
    const guideNode = guide ? scheduleGuide(ctx, tl, t0) : undefined;
    run.current = { tracker, rec, chunks, t0, recStart, raf: 0, trace: [], done: false, guide: guideNode };
    setPhase('countin');
    let scored = 0;
    const loop = () => {
      const r = run.current;
      if (!r) return;
      const t = ctx.currentTime - r.t0;
      setNow(t);
      if (t >= 0) setPhase('running');
      // Score each phrase as soon as it is over.
      while (scored < tl.phrases.length && t > tl.phrases[scored].t1 + 0.1) {
        const i = scored;
        const s = scorePhrases(tl, r.trace, tol)[i];
        setScores(prev => prev.map((v, k) => (k === i ? s : v)));
        scored++;
      }
      if (t > tl.total + 0.3) { finish(); return; }
      r.raf = requestAnimationFrame(loop);
    };
    run.current.raf = requestAnimationFrame(loop);
  };

  const abort = () => { stopAll(); setPhase('ready'); setNow(-1); setTrace([]); };

  const active = tl.phrases.findIndex(p => now >= p.t0 && now < p.t1);
  const countdown = phase === 'countin' ? Math.min(4, Math.ceil(-now / tl.beat)) : 0;

  return (
    <Phone label="10e Exercice">
      <StatusBar />
      <div className="voice-scroll session">
        <div className="head">
          <div className="head-l">
            <BackButton fallback={piece.kind === 'warmup' ? '/voix/exercices' : '/voix/melodies'} />
            <div className="head-titles">
              <span className="kicker">{piece.kind === 'warmup' ? 'Échauffement' : 'Chanter sur la mélodie'}</span>
              <h1 className="display" style={{ fontSize: 26, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{piece.title.toUpperCase()}</h1>
            </div>
          </div>
        </div>
        <div className="session-status">
          {phase === 'countin' ? <span className="count">Prêt… <b>{countdown}</b></span>
            : phase === 'running' ? <span>{active >= 0 ? tl.phrases[active].label : 'Respirez…'}</span>
              : phase === 'saving' ? <span>Enregistrement de la prise…</span>
                : <span>{noteFr(Math.min(...tl.targets.map(t => t.midi)))} → {noteFr(Math.max(...tl.targets.map(t => t.to ?? t.midi)))} · {piece.bpm} BPM · {Math.round(tl.total)} s</span>}
        </div>
        <PitchRoll lo={lo} hi={hi} height={330} window={6} now={Math.max(now, -4 * tl.beat)} targets={tl.targets} trace={trace} tol={tol} targetAt={t => targetAt(tl, t)} />
        <PhraseChips tl={tl} scores={scores} />
        {phase === 'error' && micError && <MicMessage state={micError} retry={() => void start()} />}
        {(phase === 'ready' || phase === 'error') && (
          <>
            <button className="settings-row guide-row" onClick={() => setGuide(!guide)} aria-pressed={guide}>
              <span className="settings-label">Guide sonore {guide ? '(écouteurs conseillés)' : ''}</span>
              <span className={'switch' + (guide ? ' on' : '')}><span /></span>
            </button>
            <ToleranceStepper tol={tol} setTol={setTol} />
          </>
        )}
      </div>
      {phase === 'ready' || phase === 'error'
        ? <button className="cta" onClick={() => void start()}>▶  Commencer</button>
        : phase !== 'saving' && <button className="cta on" onClick={abort}>■  Arrêter</button>}
      <TabBar active={2} />
    </Phone>
  );
}

/* ---------- Take review (also the result screen) ---------- */

export function VoixPrise() {
  const { takeId = '' } = useParams();
  const nav = useNavigate();
  const take = readStored<Take[]>(TAKES_KEY, []).find(t => t.id === takeId);
  const piece = take && pieceById(take.pieceId);
  const tl = useMemo(() => (piece && take ? buildTimeline(piece, take.tonic) : null), [piece, take]);
  const [url, setUrl] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState<number | undefined>(undefined);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!take?.hasAudio) return;
    let u: string | null = null;
    void getBlob(take.id).then(b => { if (b) { u = URL.createObjectURL(b); setUrl(u); } });
    return () => { audio.current?.pause(); if (u) URL.revokeObjectURL(u); };
  }, [take?.id, take?.hasAudio]);

  if (!take || !piece || !tl) return <Navigate to="/voix/prises" replace />;
  const { lo, hi } = rollRange(tl);
  const offset = take.audioOffset ?? 0;

  const toggle = () => {
    if (!url) return;
    if (audio.current && !audio.current.paused) { audio.current.pause(); return; }
    const a = audio.current ?? new Audio(url);
    audio.current = a;
    if (a.ended || a.currentTime === 0) a.currentTime = Math.max(0, offset - 0.2);
    const tick = () => {
      setPlayhead(a.currentTime - offset);
      if (!a.paused && !a.ended) requestAnimationFrame(tick);
      else setPlayhead(p => p);
    };
    a.onended = () => setPlayhead(undefined);
    void a.play().then(() => requestAnimationFrame(tick));
  };
  const playing = !!audio.current && !audio.current.paused;

  return (
    <Phone label="10f Prise">
      <StatusBar />
      <div className="voice-scroll session">
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/voix/prises" />
            <div className="head-titles">
              <span className="kicker">Prise · {new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(take.date)}</span>
              <h1 className="display" style={{ fontSize: 26, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{take.title.toUpperCase()}</h1>
            </div>
          </div>
        </div>
        <div className="result">
          <span className="result-score" style={{ color: scoreColor(take.score) }}>{take.score}</span>
          <div className="result-side">
            <b>{verdict(take.score)}</b>
            <span>Temps passé dans la zone juste (±{take.tol} ct), en moyenne sur {tl.phrases.length} phrase{tl.phrases.length > 1 ? 's' : ''}.</span>
          </div>
        </div>
        <PhraseChips tl={tl} scores={take.phrases} />
        <PitchRoll lo={lo} hi={hi} height={280} window={tl.total + 0.4} playhead={playhead} targets={tl.targets} trace={take.trace} tol={take.tol} targetAt={t => targetAt(tl, t)} />
        <div className="legend">
          <span><i style={{ background: ACC_COLOR.good }} />juste</span>
          <span><i style={{ background: ACC_COLOR.close }} />proche</span>
          <span><i style={{ background: ACC_COLOR.off }} />faux</span>
          <span><i className="bar" />note visée</span>
        </div>
        <div className="review-btns">
          <button className="btn-outline" onClick={toggle} disabled={!url}>{!take.hasAudio ? 'Pas d’audio' : playing ? '❚❚  Pause' : '▶  Réécouter'}</button>
          <button className="btn-outline" onClick={() => nav(`/voix/ex/${piece.id}`)}>Recommencer</button>
        </div>
        <button className="btn-outline" onClick={() => nav('/voix/prises')}>Toutes mes prises ›</button>
      </div>
      <TabBar active={2} />
    </Phone>
  );
}
