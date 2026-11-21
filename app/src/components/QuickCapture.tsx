import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { startRecording, type Recording } from '../lib/audio';
import { TRACKS } from '../lib/backing';
import { putBlob } from '../lib/blobs';
import { grooveDef, readGrids } from '../lib/grids';
import { INITIAL_IDEAS, mmss, type Idea } from '../lib/ideas';
import { readStored, useStoredState } from '../lib/store';
import { Wave } from './Wave';
import { IdeaEditor } from '../screens/IdeaEditor';
import './QuickCapture.css';

const LIVE_BARS = 44;

/** What the screen being used says about the idea: tempo, key, style. */
function contextTags(path: string): Partial<Idea> {
  if (path === '/metronome') return { bpm: readStored('metro.bpm', 92) };
  const grid = path.match(/^\/composer\/grille\/(.+)$/);
  if (grid) {
    const g = readGrids().find(x => x.id === grid[1]);
    return g ? { key: g.key, bpm: g.bpm, style: grooveDef(g.groove).style } : {};
  }
  if (path === '/pratiquer/backing') {
    const t = TRACKS.find(x => x.id === readStored<string | null>('backing.sel', null));
    if (!t) return {};
    const tw = readStored<Record<string, { key: number; bpm: number }>>('backing.tweaks', {})[t.id] ?? { key: t.key, bpm: t.bpm };
    return { key: tw.key, minor: t.minor, bpm: tw.bpm, style: t.style };
  }
  if (path === '/pratiquer/gammes') return { key: readStored('scale.key', 9) };
  return {};
}

/**
 * « + Idée », on every screen that has the tab bar: records (or takes a note) on the spot, over
 * whatever is playing, then files the idea in the notebook with the tempo and key of the moment.
 * The button goes where `children` puts it (the middle of the tab bar); sheets cover the screen.
 */
export function QuickCapture({ children }: { children: (button: ReactNode) => ReactNode }) {
  const loc = useLocation();
  const [, setIdeas] = useStoredState<Idea[]>('ideas', INITIAL_IDEAS);
  const [mode, setMode] = useState<'closed' | 'rec' | 'error' | 'text'>('closed');
  const [live, setLive] = useState<number[]>(() => Array(LIVE_BARS).fill(0.08));
  const [elapsed, setElapsed] = useState(0);
  const [note, setNote] = useState({ title: '', text: '' });
  const [naming, setNaming] = useState<Idea | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const recording = useRef<Recording | null>(null);
  const start = async () => {
    setLive(Array(LIVE_BARS).fill(0.08));
    setElapsed(0);
    setMode('rec');
    try {
      let last = 0;
      recording.current = await startRecording(level => {
        const now = performance.now();
        if (now - last < 70) return;
        last = now;
        setLive(l => [...l.slice(1), Math.max(0.08, level)]);
      });
    } catch {
      recording.current = null;
      setMode('error');
    }
  };

  useEffect(() => {
    if (mode !== 'rec') return;
    const t0 = performance.now();
    const t = setInterval(() => setElapsed((performance.now() - t0) / 1000), 200);
    return () => clearInterval(t);
  }, [mode]);
  useEffect(() => () => recording.current?.cancel(), []);
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), 5000);
    return () => clearTimeout(t);
  }, [saved]);

  const cancel = () => { recording.current?.cancel(); recording.current = null; setMode('closed'); };
  const file = (idea: Idea) => {
    setIdeas(list => [idea, ...list.filter(x => x.id !== idea.id)]);
    setNaming(idea);
  };

  const stopAndFile = async () => {
    const r = recording.current;
    recording.current = null;
    setMode('closed');
    if (!r) return;
    const { url, blob, duration, wave } = await r.stop();
    const when = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date());
    const id = 'rec' + Date.now();
    const kept = await putBlob(id, blob);
    file({ id, kind: 'memo', title: `Mémo du ${when}`, created: Date.now(), duration, wave, audioUrl: url, hasAudio: kept, ...contextTags(loc.pathname) });
  };

  const writeInstead = () => { recording.current?.cancel(); recording.current = null; setNote({ title: '', text: '' }); setMode('text'); };
  const fileNote = () => {
    const text = note.text.trim();
    const title = note.title.trim() || text.split('\n')[0].slice(0, 40) || 'Note';
    setMode('closed');
    file({ id: 'txt' + Date.now(), kind: 'paroles', title, created: Date.now(), text, ...contextTags(loc.pathname) });
  };

  const done = (i: Idea) => {
    setIdeas(list => list.map(x => (x.id === i.id ? i : x)));
    setNaming(null);
    setSaved(i.title);
  };

  return (
    <>
      {children(
        <button className="tab tab-idea" onClick={() => void start()} aria-label="Nouvelle idée" disabled={mode !== 'closed' || !!naming}>
          <span className="tab-idea-plus" aria-hidden>+</span>Idée
        </button>,
      )}

      {saved && (
        <div className="qc-toast" role="status">
          <span>Rangé dans le Carnet : <b>{saved}</b></span>
          <Link to="/composer" onClick={() => setSaved(null)}>Voir ›</Link>
        </div>
      )}

      {(mode === 'rec' || mode === 'error') && (
        <div className="rec-sheet qc-sheet" role="dialog" aria-label="Capture rapide">
          {mode === 'rec' ? (
            <>
              <div className="rec-head">
                <span className="rec-kicker"><span className="rec-led" />Enregistrement</span>
                <span className="rec-time mono">{mmss(elapsed)}</span>
              </div>
              <Wave bars={live} live />
              <div className="rec-btns">
                <button className="rec-cancel" onClick={cancel}>Annuler</button>
                <button className="rec-save" onClick={() => void stopAndFile()}>■ Arrêter et ranger</button>
              </div>
            </>
          ) : (
            <>
              <div className="rec-head"><span className="rec-kicker">Micro indisponible</span></div>
              <p className="rec-error">Autorisez l’accès au micro dans le navigateur, ou notez l’idée par écrit.</p>
              <div className="rec-btns">
                <button className="rec-cancel" onClick={cancel}>Fermer</button>
                <button className="rec-save" onClick={() => void start()}>Réessayer</button>
              </div>
            </>
          )}
          <button className="qc-switch" onClick={writeInstead}>Écrire plutôt ›</button>
        </div>
      )}

      {mode === 'text' && (
        <div className="rec-sheet qc-sheet" role="dialog" aria-label="Note rapide">
          <div className="rec-head"><span className="rec-kicker">Note rapide</span></div>
          <input className="text-input" placeholder="Titre (facultatif)" value={note.title} maxLength={60}
            onChange={e => setNote({ ...note, title: e.target.value })} aria-label="Titre" />
          <textarea className="text-input qc-text" rows={4} placeholder="Des paroles, une idée d’arrangement…" value={note.text} autoFocus
            onChange={e => setNote({ ...note, text: e.target.value })} aria-label="Texte" />
          <div className="rec-btns">
            <button className="rec-cancel" onClick={() => setMode('closed')}>Annuler</button>
            <button className="rec-save" disabled={!note.text.trim() && !note.title.trim()} onClick={fileNote}>Ranger dans le Carnet</button>
          </div>
        </div>
      )}

      {naming && <IdeaEditor idea={naming} isNew onSave={done} onClose={() => { setSaved(naming.title); setNaming(null); }} />}
    </>
  );
}
