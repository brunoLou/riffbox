import { useEffect, useReducer, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { putBlob } from '../lib/blobs';
import { dateStamp, shareOrDownload } from '../lib/files';
import { INITIAL_IDEAS, type Idea } from '../lib/ideas';
import { LOOP_BPM, LOOP_DEFAULTS, mix, peaks, type LoopSettings } from '../lib/loop';
import { LooperEngine } from '../lib/looperEngine';
import { KEY_FR } from '../lib/music';
import { usePedal } from '../lib/pedal';
import { readStored, useStoredState } from '../lib/store';
import { markUsed } from '../lib/usage';
import { encodeWav } from '../lib/wav';
import { makeZip } from '../lib/zip';
import './Looper.css';

const LATENCY_KEY = 'looper.latencyMs';
/** One looper for the app: its layers stay while you visit other screens (until the app is closed). */
let engine: LooperEngine | null = null;
const getEngine = () => (engine ??= new LooperEngine(readStored<LoopSettings>('looper.settings', LOOP_DEFAULTS)));

const fmtMb = (b: number) => `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} Mo en mémoire`;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/** /pratiquer/looper — record a loop over a click, then layers on top, all in time. */
export default function Looper() {
  const nav = useNavigate();
  const from = useLocation().state as { bpm?: number; key?: number; minor?: boolean; title?: string } | null;
  const e = getEngine();
  const [, render] = useReducer((n: number) => n + 1, 0);
  const [settings, setSettings] = useStoredState<LoopSettings>('looper.settings', LOOP_DEFAULTS);
  const [click, setClick] = useStoredState('looper.click', true);
  const [latencyMs, setLatencyMs] = useStoredState<number | null>(LATENCY_KEY, null);
  const [key, setKey] = useState<{ key: number; minor: boolean } | null>(from?.key !== undefined ? { key: from.key, minor: !!from.minor } : null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [denied, setDenied] = useState(false);
  const [confirmMerge, setConfirmMerge] = useState(false);
  const [, setIdeas] = useStoredState<Idea[]>('ideas', INITIAL_IDEAS);
  const pos = useRef(e.position());
  const ring = useRef<SVGCircleElement>(null);
  const beatEl = useRef<HTMLSpanElement>(null);

  // Settings from a grid (tempo, key) when the looper is empty.
  useEffect(() => {
    if (from?.bpm && !e.layers.length) setSettings({ ...settings, bpm: Math.max(LOOP_BPM.min, Math.min(LOOP_BPM.max, from.bpm)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (!e.running && !e.layers.length) e.settings = settings; }, [e, settings]);
  useEffect(() => { e.click = click; }, [e, click]);
  useEffect(() => { e.latency = (latencyMs ?? Math.round(e.guessLatency() * 1000)) / 1000; }, [e, latencyMs]);
  useEffect(() => {
    e.onChange = render;
    return () => { e.onChange = () => {}; e.stop(); e.closeMic(); };
  }, [e]);

  // The ring and the beat follow the audio clock, without re-rendering the screen.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const p = e.position();
      pos.current = p;
      if (ring.current) ring.current.style.strokeDashoffset = String(1 - p.phase);
      if (beatEl.current) beatEl.current.textContent = p.countin !== null ? String(p.countin) : e.running ? `${p.bar + 1}.${p.beat + 1}` : '';
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [e]);

  const s = e.state;
  const busy = s.kind === 'countin' || s.kind === 'armed' || s.kind === 'recording';
  const locked = e.layers.length > 0 || e.running;

  const record = async () => {
    setMsg(null);
    if (busy) { e.cancelRecording(); return; }
    try { await e.record(); setDenied(false); markUsed('looper'); }
    catch { setDenied(true); e.stop(); }
  };
  const playStop = () => { if (e.running) e.stop(); else e.play(); };
  const undo = () => { const last = e.layers[e.layers.length - 1]; if (last && !busy) e.removeLayer(last.id); };
  usePedal({ right: () => void record(), middle: playStop, left: undo });

  const mixdown = () => mix(e.layers.map(l => ({ data: l.data, gain: l.muted ? 0 : l.gain })), e.frames);
  const keyLabel = key ? `${KEY_FR[key.key]}${key.minor ? ' m' : ''}` : '';
  const title = from?.title ? `Boucle · ${from.title}` : `Boucle ${settings.bpm} BPM${keyLabel ? ` en ${keyLabel}` : ''}`;
  const meta = () => ({ bpm: settings.bpm, root: key?.key, date: dateStamp() });

  const keep = async () => {
    const data = mixdown();
    const wav = encodeWav([data], e.sampleRate, { ...meta(), title });
    const id = 'loop' + Date.now();
    const saved = await putBlob(id, wav);
    setIdeas(list => [{
      id, kind: 'riff', title, created: Date.now(), bpm: settings.bpm, key: key?.key, minor: key?.minor || undefined,
      duration: Math.round(e.length), wave: peaks(data, 40), hasAudio: saved, audioUrl: URL.createObjectURL(wav),
    }, ...list]);
    setMsg(saved ? { text: `« ${title} » est dans le carnet (une boucle, ${fmt(e.length)}).` } : { text: 'Le carnet n’a pas pu garder le son.', error: true });
  };

  const exportStems = async () => {
    const enc = new TextEncoder();
    const sr = e.sampleRate;
    const base = `RIFFBOX boucle ${dateStamp()} - ${settings.bpm} BPM${keyLabel ? ` - ${keyLabel.replace('♯', '#').replace('♭', 'b').replace(' m', 'm')}` : ''}`;
    const files = await Promise.all([
      ...e.layers.map(async (l, i) => ({ name: `${base}/Couche ${i + 1}.wav`, data: new Uint8Array(await encodeWav([l.data], sr, { ...meta(), title: `Couche ${i + 1}` }).arrayBuffer()) })),
      (async () => ({ name: `${base}/Mix.wav`, data: new Uint8Array(await encodeWav([mixdown()], sr, { ...meta(), title: 'Mix' }).arrayBuffer()) }))(),
    ]);
    files.push({ name: `${base}/LISEZMOI.txt`, data: enc.encode(`Boucle de ${settings.bars} mesure(s) en ${settings.beats}/4 à ${settings.bpm} BPM (${fmt(e.length)}).\r\n` +
      `Chaque couche et le mix durent exactement une boucle : posez-les au début d'une mesure, en boucle, au tempo du projet.\r\n` +
      `WAV 24 bits, ${sr} Hz, mono, tempo inscrit dans le fichier (Ableton Live, FL Studio).\r\n`) });
    const how = await shareOrDownload(`riffbox-boucle-${dateStamp()}.zip`, makeZip(files), 'Boucle RIFFBOX');
    if (how !== 'cancelled') setMsg({ text: `${e.layers.length} couche${e.layers.length > 1 ? 's' : ''} et le mix exportés en WAV.` });
  };

  const measure = async () => {
    setMsg(null); setMeasuring(true);
    try {
      const l = await e.measure();
      if (l === null) setMsg({ text: 'Bips mal entendus. Retirez le casque, montez le volume, et réessayez au calme.', error: true });
      else { setLatencyMs(Math.round(l * 1000)); setMsg({ text: `Retard mesuré : ${Math.round(l * 1000)} ms.` }); }
    } catch { setDenied(true); }
    finally { setMeasuring(false); }
  };

  const set = (p: Partial<LoopSettings>) => setSettings({ ...settings, ...p });
  const latency = latencyMs ?? Math.round(e.guessLatency() * 1000);
  const mainLabel = s.kind === 'countin' ? 'Décompte… (annuler)'
    : s.kind === 'armed' ? 'Au début de la boucle… (annuler)'
    : s.kind === 'recording' ? '● Enregistrement… (annuler)'
    : e.layers.length ? '＋ Superposer' : '● Enregistrer';

  return (
    <Phone label="Looper">
      <StatusBar />
      <div className="screen-body looper-body" style={{ gap: 12 }}>
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/pratiquer" />
            <div className="head-titles">
              <span className="kicker">Pratiquer</span>
              <h1 className="display" style={{ fontSize: 30 }}>LOOPER</h1>
            </div>
          </div>
        </div>

        <div className="loop-settings">
          <div className="sheet-field row">
            <span>Tempo</span>
            <div className="mini-stepper">
              <button onClick={() => set({ bpm: Math.max(LOOP_BPM.min, settings.bpm - 1) })} disabled={locked} aria-label="Ralentir">−</button>
              <span className="mono">{settings.bpm} BPM</span>
              <button onClick={() => set({ bpm: Math.min(LOOP_BPM.max, settings.bpm + 1) })} disabled={locked} aria-label="Accélérer">+</button>
            </div>
          </div>
          <div className="sheet-field row">
            <span>Mesure</span>
            <div className="seg loop-seg" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
              {([3, 4] as const).map(b => <button key={b} className={settings.beats === b ? 'on' : ''} aria-pressed={settings.beats === b} disabled={locked} onClick={() => set({ beats: b })}>{b}/4</button>)}
            </div>
          </div>
          <div className="sheet-field row">
            <span>Longueur</span>
            <div className="seg loop-seg wide" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }} role="group" aria-label="Mesures par boucle">
              {([1, 2, 4, 8] as const).map(b => <button key={b} className={settings.bars === b ? 'on' : ''} aria-pressed={settings.bars === b} disabled={locked} onClick={() => set({ bars: b })}>{b}</button>)}
            </div>
          </div>
          <button className="settings-row loop-click" onClick={() => setClick(!click)} aria-pressed={click}>
            <span className="settings-label">Clic pendant la boucle</span>
            <span className={'switch' + (click ? ' on' : '')}><span /></span>
          </button>
          {locked && <p className="loop-note">Tempo et longueur sont fixés par la première couche. « Tout effacer » pour les changer.</p>}
        </div>

        <div className={'loop-stage' + (s.kind === 'recording' ? ' rec' : '')} data-theme="dark">
          <svg viewBox="0 0 120 120" className="loop-ring" aria-hidden>
            <circle cx="60" cy="60" r="52" className="ring-bg" />
            <circle ref={ring} cx="60" cy="60" r="52" className="ring-fg" pathLength={1} strokeDasharray="1" strokeDashoffset="1" />
          </svg>
          <div className="loop-center">
            <span className="loop-beat mono" ref={beatEl} />
            <span className="loop-state" role="status">
              {s.kind === 'countin' ? 'Décompte' : s.kind === 'armed' ? 'Prêt' : s.kind === 'recording' ? 'Enregistrement' : s.kind === 'playing' ? 'Lecture' : e.layers.length ? 'Arrêté' : 'Prêt'}
            </span>
            <span className="loop-len mono">{settings.bars} mes. · {fmt(e.length)}</span>
          </div>
        </div>

        <div className="loop-transport">
          <button className={'loop-rec' + (busy ? ' on' : '')} onClick={() => void record()}>{mainLabel}</button>
          <div className="confirm-row">
            <button className="btn-outline" onClick={playStop} disabled={!e.layers.length || busy}>{e.running && !busy ? '■ Arrêter' : '▶ Lecture'}</button>
            <button className="btn-outline" onClick={undo} disabled={!e.layers.length || busy}>↶ Annuler la dernière</button>
          </div>
        </div>
        {denied && <p className="backup-msg error" role="alert">Micro refusé : autorisez-le dans le navigateur.</p>}

        {e.layers.length > 0 && (
          <div className="loop-layers-head">
            <span className="kicker">{e.layers.length} couche{e.layers.length > 1 ? 's' : ''} · {fmtMb(e.bytes)}</span>
            {confirmMerge ? (
              <span className="merge-confirm" role="group" aria-label="Confirmer la fusion">
                <button className="btn-link" onClick={() => setConfirmMerge(false)}>Annuler</button>
                <button className="merge-btn on" onClick={() => { const n = e.mergeable.length; e.mergeLayers(); setConfirmMerge(false); setMsg({ text: `${n} couches fusionnées en une.` }); }}>
                  Fusionner {e.mergeable.length} couches
                </button>
              </span>
            ) : (
              <button className="merge-btn" onClick={() => setConfirmMerge(true)} disabled={busy || e.mergeable.length < 2}>Fusionner…</button>
            )}
          </div>
        )}
        {confirmMerge && (
          <p className="loop-note">Les couches audibles deviennent une seule, à leurs volumes actuels : vous libérez de la mémoire, mais ne pourrez plus les séparer. Les couches muettes restent à part.</p>
        )}
        {e.layers.length > 0 && (
          <div className="loop-layers">
            {e.layers.map((l, i) => (
              <div key={l.id} className={'loop-layer' + (l.muted ? ' muted' : '')}>
                <span className="layer-name">Couche {i + 1}</span>
                <span className="layer-wave" aria-hidden>{peaks(l.data, 24).map((p, k) => <i key={k} style={{ height: `${Math.max(6, p * 100)}%` }} />)}</span>
                <input type="range" min={0} max={1} step={0.05} value={l.gain} aria-label={`Volume de la couche ${i + 1}`}
                  onChange={ev => e.setGain(l.id, Number(ev.target.value), l.muted)} />
                <button className={'layer-mute' + (l.muted ? ' on' : '')} aria-pressed={l.muted} onClick={() => e.setGain(l.id, l.gain, !l.muted)}>Muet</button>
                <button className="layer-del" onClick={() => e.removeLayer(l.id)} aria-label={`Supprimer la couche ${i + 1}`} disabled={busy}>✕</button>
              </div>
            ))}
          </div>
        )}

        {e.layers.length > 0 && (
          <div className="loop-actions">
            <label className="sheet-field row">
              <span>Tonalité (facultatif)</span>
              <select className="text-input loop-key" value={key ? `${key.key}${key.minor ? 'm' : ''}` : ''}
                onChange={ev => { const v = ev.target.value; setKey(v ? { key: parseInt(v, 10), minor: v.endsWith('m') } : null); }}>
                <option value="">—</option>
                {KEY_FR.map((k, i) => <option key={i} value={i}>{k}</option>)}
                {KEY_FR.map((k, i) => <option key={'m' + i} value={`${i}m`}>{k} mineur</option>)}
              </select>
            </label>
            <button className="btn-primary" onClick={() => void keep()} disabled={busy}>Garder dans le carnet</button>
            <button className="btn-outline" onClick={() => void exportStems()} disabled={busy}>Exporter les pistes (.zip)</button>
            <button className="btn-link" onClick={() => { e.clear(); setMsg(null); }} disabled={busy}>Tout effacer</button>
          </div>
        )}
        {msg && <p className={'backup-msg' + (msg.error ? ' error' : '')} role="status">{msg.text}</p>}

        <div className="loop-latency">
          <div className="sheet-field row">
            <span>Retard du micro</span>
            <div className="mini-stepper">
              <button onClick={() => setLatencyMs(Math.max(0, latency - 5))} aria-label="Moins de retard">−</button>
              <span className="mono">{latency} ms</span>
              <button onClick={() => setLatencyMs(Math.min(500, latency + 5))} aria-label="Plus de retard">+</button>
            </div>
          </div>
          <p className="loop-note">
            Le son met un peu de temps à sortir du haut-parleur et à revenir par le micro : ce retard est retiré de chaque couche.
            {latencyMs === null && ' Valeur estimée : mesurez-la une fois.'}
          </p>
          <button className="btn-outline" onClick={() => void measure()} disabled={measuring || busy || e.running}>
            {measuring ? 'Écoute des bips…' : 'Mesurer le retard (sans casque)'}
          </button>
          <p className="loop-note">Pour superposer, un casque ou une interface audio évite que le haut-parleur repasse dans le micro. Pédalier : → enregistrer, espace lecture / arrêt, ← annuler la dernière.</p>
        </div>
        <button className="btn-link loop-carnet" onClick={() => nav('/composer')}>Voir le carnet ›</button>
      </div>
      <TabBar active={2} />
    </Phone>
  );
}

