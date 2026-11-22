import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { useSongs } from '../lib/hooks';
import { CONFIDENCE_FR, KeyListener, keyLabel, relativeOf, type KeyGuess } from '../lib/keyDetect';
import { listenSpectrum, type SpectrumListener } from '../lib/micSpectrum';
import { mod12 } from '../lib/music';
import { writeStored } from '../lib/store';
import { markUsed } from '../lib/usage';
import { useDialog } from '../lib/useDialog';
import { mmss } from '../lib/ideas';
import './DetecteurTon.css';

const NOTE_NAMES = ['Do', 'Do♯', 'Ré', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const scaleOf = (g: Pick<KeyGuess, 'key' | 'minor'>) => {
  const tonic = g.minor ? mod12(g.key + 3) : g.key; // natural minor = notes of its relative major
  return new Set(MAJOR_SCALE.map(i => mod12(tonic + i)));
};
type Verdict = NonNullable<ReturnType<KeyListener['verdict']>>;

/**
 * « Quel ton ? »: listens to a piece (a speaker, or the guitar) and tells its key, with how sure it
 * is. From a song's page it can set that song's key.
 */
export default function DetecteurTon() {
  const nav = useNavigate();
  const loc = useLocation();
  const forSong = (loc.state as { songId?: string } | null)?.songId;
  const [songs, setSongs] = useSongs();
  const target = forSong ? songs.find(s => s.id === forSong) : undefined;

  const [state, setState] = useState<'idle' | 'starting' | 'listening' | 'denied'>('idle');
  const [heard, setHeard] = useState(0);
  const [level, setLevel] = useState(0);
  const [notes, setNotes] = useState<number[]>(() => new Array(12).fill(0));
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [picked, setPicked] = useState<Pick<KeyGuess, 'key' | 'minor'> | null>(null);
  const [choose, setChoose] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const listener = useRef(new KeyListener());
  const mic = useRef<SpectrumListener | null>(null);
  const dlg = useDialog(() => setChoose(false));

  const stop = () => { mic.current?.stop(); mic.current = null; setState(s => (s === 'listening' || s === 'starting' ? 'idle' : s)); setLevel(0); };
  useEffect(() => () => mic.current?.stop(), []);

  const start = async () => {
    setMsg(null);
    setState('starting');
    try {
      let last = 0;
      mic.current = await listenSpectrum(f => {
        listener.current.add(f.mags, f.sampleRate, f.fftSize, f.rms);
        setLevel(Math.min(1, f.rms * 8));
        if (f.ms - last < 500) return; // the verdict twice a second is plenty
        last = f.ms;
        setHeard(listener.current.heard);
        setNotes(listener.current.notes);
        const v = listener.current.verdict();
        if (v) { setVerdict(v); markUsed('detect'); }
      });
      setState('listening');
    } catch {
      setState('denied');
    }
  };
  const restart = () => { listener.current.reset(); setHeard(0); setNotes(new Array(12).fill(0)); setVerdict(null); setPicked(null); setMsg(null); };

  // The key shown: the best guess, or the relative the player chose when both were possible.
  const key = picked ?? verdict?.best ?? null;
  const rel = key ? relativeOf(key) : null;
  const inScale = key ? scaleOf(key) : new Set<number>();
  const max = Math.max(...notes, 0.0001);

  const openScale = () => {
    if (!key) return;
    writeStored('scale.key', key.key);
    writeStored('scale.id', key.minor ? 'eolien' : 'ionien');
    nav('/pratiquer/gammes');
  };
  const applyTo = (id: string) => {
    if (!key) return;
    const s = songs.find(x => x.id === id);
    setSongs(all => all.map(x => (x.id === id ? { ...x, key: key.key, minor: key.minor || undefined } : x)));
    setChoose(false);
    setMsg(`« ${s?.title} » est maintenant en ${keyLabel(key)}.`);
  };

  return (
    <Phone label="12 Quel ton ?">
      <StatusBar />
      <div className="screen-body detect-body" style={{ gap: 12 }}>
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/pratiquer" />
            <div className="head-titles">
              <span className="kicker">Outils</span>
              <h1 className="display" style={{ fontSize: 30 }}>QUEL TON ?</h1>
            </div>
          </div>
        </div>
        <p className="detect-help">
          Faites écouter un morceau, sur une enceinte ou à la guitare, pendant une vingtaine de secondes.
          {target && <> Le résultat pourra être appliqué à « {target.title} ».</>}
        </p>

        <div className="detect-mic" data-theme="dark">
          <span className={'led detect-led' + (state === 'listening' && level > 0.08 ? ' on' : '')} aria-hidden />
          <div className="detect-mic-text">
            <span className="detect-mic-state" role="status">
              {state === 'listening' ? (level > 0.08 ? 'J’écoute…' : 'J’écoute… (rien n’est assez fort)')
                : state === 'starting' ? 'Micro…'
                : state === 'denied' ? 'Micro refusé : autorisez-le dans le navigateur.'
                : verdict ? 'Écoute arrêtée' : 'Prêt'}
            </span>
            <span className="detect-time mono">{mmss(heard)} de musique</span>
          </div>
          {state === 'listening' || state === 'starting'
            ? <button className="detect-btn on" onClick={stop}>■ Arrêter</button>
            : <button className="detect-btn" onClick={() => void start()}>▶ Écouter</button>}
        </div>

        <div className="detect-notes" aria-label="Notes entendues">
          {notes.map((v, i) => (
            <div key={i} className={'detect-note' + (inScale.has(i) ? ' in' : '') + (key && i === key.key ? ' tonic' : '')}>
              <span className="detect-bar"><span style={{ height: `${Math.round((v / max) * 100)}%` }} /></span>
              <span className="detect-name">{NOTE_NAMES[i]}</span>
            </div>
          ))}
        </div>

        {key ? (
          <div className="detect-result" role="status" aria-live="polite">
            <span className={'detect-conf ' + verdict!.confidence}>{CONFIDENCE_FR[verdict!.confidence]}</span>
            <span className="detect-key">{keyLabel(key)}</span>
            {verdict!.relativeClose && rel && (
              <button className="detect-rel" onClick={() => setPicked(rel)}>
                ou <b>{keyLabel(rel)}</b> ? Mêmes notes : choisir celle-ci
              </button>
            )}
            {!verdict!.relativeClose && verdict!.others.length > 0 && (
              <span className="detect-others">Sinon : {verdict!.others.slice(0, 2).map(keyLabel).join(' · ')}</span>
            )}
            <div className="detect-actions">
              {target
                ? <button className="btn-primary" onClick={() => applyTo(target.id)}>Appliquer à « {target.title} »</button>
                : <button className="btn-primary" onClick={() => setChoose(true)}>Appliquer à un morceau…</button>}
              <div className="confirm-row">
                <button className="btn-outline" onClick={openScale}>Voir la gamme ›</button>
                <button className="btn-outline" onClick={() => nav(`/outils/capo?key=${key.key}&m=${key.minor ? 1 : 0}`)}>Capo ›</button>
              </div>
              <button className="btn-link" onClick={restart}>Recommencer l’écoute</button>
            </div>
            {msg && <p className="backup-msg" role="status">{msg}</p>}
          </div>
        ) : (
          <p className="detect-wait">{heard > 0 ? 'Encore quelques secondes…' : 'Le résultat s’affiche après quelques secondes de musique.'}</p>
        )}
      </div>

      {choose && key && (
        <div className="sheet-backdrop" onClick={() => setChoose(false)}>
          <div className="set-sheet detect-sheet" ref={dlg} role="dialog" aria-label="Appliquer à un morceau" onClick={e => e.stopPropagation()}>
            <div className="set-sheet-head">
              <span className="kicker sheet-kicker">Mettre en {keyLabel(key)}</span>
              <button className="player-close" onClick={() => setChoose(false)} aria-label="Fermer">✕</button>
            </div>
            {[...songs].sort((a, b) => a.title.localeCompare(b.title, 'fr')).map(s => (
              <button key={s.id} className="pick-row" onClick={() => applyTo(s.id)}>
                <div className="song-text">
                  <span className="song-title">{s.title}</span>
                  <span className="song-meta">Actuellement : {keyLabel({ key: s.key, minor: !!s.minor })}</span>
                </div>
                <span className="pick-plus">›</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <TabBar active={2} />
    </Phone>
  );
}
