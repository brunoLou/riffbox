import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Phone, StatusBar, TabBar } from '../components/Chrome';
import { playLick, playUrl, startRecording, type Playback, type Recording } from '../lib/audio';
import { INITIAL_IDEAS, KIND_LABEL, MOODS, STYLES, keyLabel, mmss, relativeDay, type Idea, type IdeaKind } from '../lib/ideas';
import { deleteBlob, getBlob, putBlob } from '../lib/blobs';
import { firstChords, gridSongId, grooveDef, type Grid, type GridGroove } from '../lib/grids';
import { KEY_FR, mod12 } from '../lib/music';
import { useStoredState } from '../lib/store';
import { useGrids, useSetlists } from '../lib/hooks';
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

/** A grid shown as a card in the notebook. */
type Card = Idea & { grid?: Grid };
const gridCard = (g: Grid): Card => ({
  id: g.id, kind: 'grille', title: g.title, created: g.created, key: g.key, bpm: g.bpm, style: grooveDef(g.groove).style,
  chords: firstChords(g), grid: g,
});
const GROOVE_OF_STYLE: Record<string, GridGroove> = { Blues: 'shuffle', Rock: 'rock', Funk: 'funk' };

export default function Carnet({ initialKind }: { initialKind?: IdeaKind }) {
  const nav = useNavigate();
  const loc = useLocation();
  const [ideas, setIdeas] = useStoredState<Idea[]>('ideas', INITIAL_IDEAS);
  const [grids, setGrids] = useGrids();
  const [, setSets] = useSetlists();
  const [linking, setLinking] = useState<Idea | null>(null);
  const [savedKind, setKind] = useStoredState<IdeaKind | 'all'>('carnet.kind', 'all');
  // Opening "Grilles" from home filters this visit only; the notebook's own filter is left as it was.
  const [override, setOverride] = useState<IdeaKind | undefined>(initialKind);
  const kind = override ?? savedKind;
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
    else if (i.hasAudio) return; // still loading from the device
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
    const { url, blob, duration, wave } = await r.stop();
    const when = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date());
    const id = 'rec' + Date.now();
    const saved = await putBlob(id, blob);
    const idea: Idea = { id, kind: 'memo', title: `Mémo du ${when}`, created: Date.now(), duration, wave, audioUrl: url, hasAudio: saved };
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

  // Recordings saved on the device: rebuild playable URLs after a reload.
  useEffect(() => {
    const missing = ideas.filter(i => i.hasAudio && !i.audioUrl);
    if (!missing.length) return;
    let alive = true;
    void Promise.all(missing.map(async i => [i.id, await getBlob(i.id)] as const)).then(found => {
      if (!alive) return;
      const urls = new Map(found.filter(([, b]) => b).map(([id, b]) => [id, URL.createObjectURL(b!)]));
      setIdeas(list => list.map(i => (urls.has(i.id) ? { ...i, audioUrl: urls.get(i.id) } : i.hasAudio && !i.audioUrl ? { ...i, hasAudio: false } : i)));
    });
    return () => { alive = false; };
  }, []); // once, on arrival

  const remove = (i: Card) => {
    if (!window.confirm(`Supprimer « ${i.title} » ?`)) return;
    if (playing?.id === i.id) stopPlayback();
    if (i.grid) {
      const g = i.grid;
      setGrids(all => all.filter(x => x.id !== g.id));
      if (!g.songId) setSets(all => all.map(s => ({ ...s, songIds: s.songIds.filter(x => x !== gridSongId(g)) })));
    } else {
      if (i.hasAudio) void deleteBlob(i.id);
      if (i.audioUrl) URL.revokeObjectURL(i.audioUrl);
      setIdeas(list => list.filter(x => x.id !== i.id));
      setGrids(all => all.map(g => (g.ideaId === i.id ? { ...g, ideaId: undefined } : g)));
    }
    setOpen(null);
  };

  /** New grid, empty or built from a riff (same key, tempo and style; its key becomes the first chord). */
  const newGrid = (from?: Idea) => {
    const id = 'grid' + Date.now();
    const minor = !!from?.minor;
    const tonic = from?.key ?? 9;
    const g: Grid = {
      id, title: from ? from.title : 'Nouvelle grille', created: Date.now(),
      key: minor ? mod12(tonic + 3) : tonic, bpm: from?.bpm ?? 90,
      groove: (from?.style && GROOVE_OF_STYLE[from.style]) || 'shuffle',
      prog: [from?.key != null ? [{ pc: tonic, m: minor }] : [], [], []],
      ideaId: from?.id,
    };
    setGrids(all => [g, ...all]);
    nav(`/composer/grille/${id}`);
  };
  const linkTo = (i: Idea, g: Grid) => {
    setGrids(all => all.map(x => (x.id === g.id ? { ...x, ideaId: i.id } : x)));
    nav(`/composer/grille/${g.id}`);
  };

  const cards: Card[] = [...ideas, ...grids.map(gridCard)].sort((a, b) => b.created - a.created);
  const keyOptions = useMemo(() => [...new Set(cards.filter(i => i.key != null).map(keyLabel))].sort(), [ideas, grids]);
  const shown = cards.filter(i =>
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
          <span className="carnet-count mono">{cards.length} idée{cards.length > 1 ? 's' : ''}</span>
        </div>

        <div className="hscroll" style={{ gap: 6 }}>
          {KIND_FILTERS.map(k => (
            <button key={k.id} className={'chip kind-chip' + (kind === k.id ? ' on-cream' : '')} onClick={() => { setOverride(undefined); setKind(k.id); }}>{k.label}</button>
          ))}
        </div>

        <div className="fsels">
          <FilterSelect label="Ton" value={fKey} options={keyOptions} onChange={setFKey} />
          <FilterSelect label="Style" value={fStyle} options={STYLES} onChange={setFStyle} />
          <FilterSelect label="Humeur" value={fMood} options={MOODS} onChange={setFMood} />
        </div>

        {shown.map(i => {
          const isOpen = open === i.id;
          const audio = !!(i.audioUrl || i.hasAudio || i.lick);
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

              {!i.grid && grids.some(g => g.ideaId === i.id) && (
                <div className="idea-links">
                  {grids.filter(g => g.ideaId === i.id).map(g => (
                    <button key={g.id} className="idea-link" onClick={() => nav(`/composer/grille/${g.id}`)}>Grille : {g.title} ›</button>
                  ))}
                </div>
              )}

              {isOpen && (
                <div className="idea-actions">
                  {i.grid
                    ? <button className="idea-action primary" onClick={() => nav(`/composer/grille/${i.grid!.id}`)}>Ouvrir la grille ›</button>
                    : (i.kind === 'riff' || i.kind === 'memo') && <button className="idea-action primary" onClick={() => setLinking(i)}>Ajouter à une grille ›</button>}
                  <button className="idea-action danger" onClick={() => remove(i)}>Supprimer</button>
                </div>
              )}
            </div>
          );
        })}

        {!shown.length && <div className="carnet-empty">Aucune idée ne correspond à ces filtres.</div>}
      </div>

      {recState === 'idle' && (
        <div className="carnet-actions">
          <button className="cta rec-cta" onClick={startRec}><span className="rec-dot" />Enregistrer</button>
          <button className="grid-to-set" onClick={() => newGrid()}>+ Grille</button>
        </div>
      )}

      {linking && (
        <div className="sheet-backdrop" onClick={() => setLinking(null)}>
          <div className="set-sheet" role="dialog" aria-label="Ajouter à une grille" onClick={e => e.stopPropagation()}>
            <div className="set-sheet-head">
              <span className="kicker sheet-kicker">« {linking.title} » dans une grille</span>
              <button className="player-close" onClick={() => setLinking(null)} aria-label="Fermer">✕</button>
            </div>
            <button className="pick-row new-grid" onClick={() => newGrid(linking)}>
              <div className="song-text">
                <span className="song-title">Nouvelle grille avec ce riff</span>
                <span className="song-meta">
                  {linking.key != null ? `${KEY_FR[linking.key]}${linking.minor ? ' m' : ''} · ` : ''}{linking.bpm ?? 90} BPM · {linking.style ?? 'Blues'}
                </span>
              </div>
              <span className="pick-plus">+</span>
            </button>
            {grids.map(g => (
              <button key={g.id} className="pick-row" onClick={() => linkTo(linking, g)}>
                <div className="song-text">
                  <span className="song-title">Relier à « {g.title} »</span>
                  <span className="song-meta">{firstChords(g).join(' · ') || 'Grille vide'}</span>
                </div>
                {g.ideaId === linking.id ? <span className="in-set">Déjà relié ›</span> : <span className="pick-plus">›</span>}
              </button>
            ))}
          </div>
        </div>
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
