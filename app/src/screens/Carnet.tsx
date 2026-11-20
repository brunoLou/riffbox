import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Phone, StatusBar, TabBar } from '../components/Chrome';
import { playLick, playUrl, startRecording, type Playback, type Recording } from '../lib/audio';
import { INITIAL_IDEAS, KIND_LABEL, MOODS, STYLES, keyLabel, mmss, relativeDay, type Idea, type IdeaKind } from '../lib/ideas';
import { useStoredState } from '../lib/store';
import './Carnet.css';

const KIND_FILTERS: { id: IdeaKind | 'all'; label: string }[] = [
  { id: 'all', label: 'Tout' }, { id: 'riff', label: 'Riffs' }, { id: 'grille', label: 'Grilles' },
  { id: 'paroles', label: 'Paroles' }, { id: 'memo', label: 'Mémos' },
];
const BADGE: Record<IdeaKind, string> = { riff: '♪', grille: 'I·V', paroles: '¶', memo: '●' };
const LIVE_BARS = 44;

function Wave({ bars, progress, live }: { bars: number[]; progress?: number; live?: boolean }) {
  return (
    <div className={'wave' + (live ? ' live' : '')} aria-hidden>
      {bars.map((h, i) => (
        <span key={i} style={{ height: `${Math.round(h * 100)}%` }} className={progress != null && i / bars.length < progress ? 'played' : ''} />
      ))}
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className={'fsel' + (value ? ' on' : '')}>
      <span className="fsel-text">{value || label}</span>
      <span className="fsel-caret">▾</span>
      <select value={value} onChange={e => onChange(e.target.value)} aria-label={label}>
        <option value="">{label} : tous</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

export default function Carnet() {
  const nav = useNavigate();
  const loc = useLocation();
  const [ideas, setIdeas] = useStoredState<Idea[]>('ideas', INITIAL_IDEAS);
  const [kind, setKind] = useStoredState<IdeaKind | 'all'>('carnet.kind', 'all');
  const [fKey, setFKey] = useStoredState('carnet.key', '');
  const [fStyle, setFStyle] = useStoredState('carnet.style', '');
  const [fMood, setFMood] = useStoredState('carnet.mood', '');
  const [open, setOpen] = useState<string | null>(null);

  // Playback
  const [playing, setPlaying] = useState<{ id: string; t0: number; dur: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const player = useRef<Playback | null>(null);

  // Recording
  const [recState, setRecState] = useState<'idle' | 'rec' | 'error'>('idle');
  const [live, setLive] = useState<number[]>(() => Array(LIVE_BARS).fill(0.08));
  const [elapsed, setElapsed] = useState(0);
  const recording = useRef<Recording | null>(null);

  const stopPlayback = () => { player.current?.stop(); player.current = null; setPlaying(null); setProgress(0); };

  const togglePlay = (i: Idea) => {
    const same = playing?.id === i.id;
    stopPlayback();
    if (same) return;
    const end = () => { player.current = null; setPlaying(null); setProgress(0); };
    if (i.audioUrl) player.current = playUrl(i.audioUrl, end);
    else if (i.lick) player.current = playLick(i.lick, i.bpm ?? 90, end);
    else return;
    setPlaying({ id: i.id, t0: performance.now(), dur: i.duration ?? 1 });
  };

  useEffect(() => {
    if (!playing) return;
    let raf = requestAnimationFrame(function f(now) {
      setProgress(Math.min(1, (now - playing.t0) / 1000 / playing.dur));
      raf = requestAnimationFrame(f);
    });
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const startRec = async () => {
    stopPlayback();
    setLive(Array(LIVE_BARS).fill(0.08));
    setElapsed(0);
    setRecState('rec');
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
      setRecState('error');
    }
  };

  useEffect(() => {
    if (recState !== 'rec') return;
    const t0 = performance.now();
    const t = setInterval(() => setElapsed((performance.now() - t0) / 1000), 200);
    return () => clearInterval(t);
  }, [recState]);

  const saveRec = async () => {
    const r = recording.current;
    recording.current = null;
    setRecState('idle');
    if (!r) return;
    const { url, duration, wave } = await r.stop();
    const when = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date());
    const idea: Idea = { id: 'rec' + Date.now(), kind: 'memo', title: `Mémo du ${when}`, created: Date.now(), duration, wave, audioUrl: url };
    setIdeas(list => [idea, ...list]);
    setKind('all'); setFKey(''); setFStyle(''); setFMood('');
    setOpen(idea.id);
  };

  const cancelRec = () => { recording.current?.cancel(); recording.current = null; setRecState('idle'); };

  // "+ Idée" from anywhere opens the notebook already recording.
  useEffect(() => {
    if ((loc.state as { record?: boolean } | null)?.record) {
      nav(loc.pathname, { replace: true, state: null });
      void startRec();
    }
  }, []); // once, on arrival

  useEffect(() => () => { player.current?.stop(); recording.current?.cancel(); }, []);

  const keyOptions = useMemo(() => [...new Set(ideas.filter(i => i.key != null).map(keyLabel))].sort(), [ideas]);
  const shown = ideas.filter(i =>
    (kind === 'all' || i.kind === kind) && (!fKey || keyLabel(i) === fKey) && (!fStyle || i.style === fStyle) && (!fMood || i.mood === fMood));

  return (
    <Phone label="04 Carnet">
      <StatusBar />
      <div className="carnet-scroll">
        <div className="head">
          <div className="head-titles">
            <span className="kicker">Composer</span>
            <span className="display" style={{ fontSize: 30 }}>CARNET D’IDÉES</span>
          </div>
          <span className="carnet-count mono">{ideas.length} idées</span>
        </div>

        <div className="hscroll" style={{ gap: 6 }}>
          {KIND_FILTERS.map(k => (
            <button key={k.id} className={'chip kind-chip' + (kind === k.id ? ' on-cream' : '')} onClick={() => setKind(k.id)}>{k.label}</button>
          ))}
        </div>

        <div className="fsels">
          <FilterSelect label="Ton" value={fKey} options={keyOptions} onChange={setFKey} />
          <FilterSelect label="Style" value={fStyle} options={STYLES} onChange={setFStyle} />
          <FilterSelect label="Humeur" value={fMood} options={MOODS} onChange={setFMood} />
        </div>

        {shown.map(i => {
          const isOpen = open === i.id;
          const audio = !!(i.audioUrl || i.lick);
          const isPlaying = playing?.id === i.id;
          const meta = [KIND_LABEL[i.kind], relativeDay(i.created), i.duration != null ? mmss(i.duration) : null].filter(Boolean).join(' · ');
          return (
            <div key={i.id} className={'idea' + (isOpen ? ' open' : '')}>
              <div className="idea-top" role="button" tabIndex={0} aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : i.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(isOpen ? null : i.id); } }}>
                <span className={'idea-badge ' + i.kind}>{BADGE[i.kind]}</span>
                <div className="idea-titles">
                  <span className="idea-title">{i.title}</span>
                  <span className="idea-meta">{meta}</span>
                </div>
                {audio && (
                  <button className={'idea-play' + (isPlaying ? ' on' : '')} onClick={e => { e.stopPropagation(); togglePlay(i); }} aria-label={isPlaying ? 'Arrêter' : 'Écouter'}>
                    {isPlaying ? '❚❚' : '▶'}
                  </button>
                )}
              </div>

              {i.wave && <Wave bars={i.wave} progress={isPlaying ? progress : undefined} />}
              {i.chords && <div className="idea-chords">{i.chords.map((c, j) => <span key={j}>{c}</span>)}</div>}
              {i.text && <div className={'idea-text' + (isOpen ? '' : ' clamp')}>{i.text}</div>}

              {(i.key != null || i.bpm || i.style || i.mood) && (
                <div className="idea-tags">
                  {i.key != null && <span className="tag key">{keyLabel(i)}</span>}
                  {i.bpm && <span className="tag">{i.bpm} BPM</span>}
                  {i.style && <span className="tag">{i.style}</span>}
                  {i.mood && <span className="tag">{i.mood}</span>}
                </div>
              )}

              {isOpen && (
                <div className="idea-actions">
                  {i.to
                    ? <button className="idea-action primary" onClick={() => nav(i.to!)}>Ouvrir la grille ›</button>
                    : <button className="idea-action primary" onClick={() => nav('/composer/grille')}>Ajouter à une grille ›</button>}                </div>
              )}
            </div>
          );
        })}

        {!shown.length && <div className="carnet-empty">Aucune idée ne correspond à ces filtres.</div>}
      </div>

      {recState === 'idle' && (
        <button className="cta rec-cta" onClick={startRec}><span className="rec-dot" />Enregistrer</button>
      )}

      {recState !== 'idle' && (
        <div className="rec-sheet" role="dialog" aria-label="Enregistrement">
          {recState === 'rec' ? (
            <>
              <div className="rec-head">
                <span className="rec-kicker"><span className="rec-led" />Enregistrement</span>
                <span className="rec-time mono">{mmss(elapsed)}</span>
              </div>
              <Wave bars={live} live />
              <div className="rec-btns">
                <button className="rec-cancel" onClick={cancelRec}>Annuler</button>
                <button className="rec-save" onClick={saveRec}>■ Arrêter et ranger</button>
              </div>
            </>
          ) : (
            <>
              <div className="rec-head"><span className="rec-kicker">Micro indisponible</span></div>
              <p className="rec-error">Autorisez l’accès au micro dans le navigateur pour enregistrer un riff.</p>
              <div className="rec-btns">
                <button className="rec-cancel" onClick={() => setRecState('idle')}>Fermer</button>
                <button className="rec-save" onClick={startRec}>Réessayer</button>
              </div>
            </>
          )}
        </div>
      )}
      <TabBar active={1} />
    </Phone>
  );
}
