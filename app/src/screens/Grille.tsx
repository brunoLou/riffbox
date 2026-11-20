import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { GRID_BAR_MS, GRID_INITIAL, GRID_SECTIONS } from '../lib/data';
import { IN_N, KFR, OUT_N, OUT_PC, chordName, degreeOf, mod12, type Chord } from '../lib/music';
import { fmtDate, titlesLabel, type Setlist } from '../lib/setlists';
import { useStoredState } from '../lib/store';
import { useSetlists } from './Setlists';
import './Grille.css';

/** The song this grid belongs to in the setlist catalog. */
const GRID_SONG_ID = 's3';

const MAX_CHORDS = 8;
const R = 159; // wheel radius (318 / 2)

export default function Grille() {
  const [key, setKey] = useStoredState('grid.key', 9);
  const [prog, setProg] = useStoredState<Chord[][]>('grid.prog', GRID_INITIAL);
  const [sec, setSec] = useState(0);
  const [mode, setMode] = useState<'add' | 'key'>('add');
  const [playing, setPlaying] = useState(false);
  const [picking, setPicking] = useState(false);
  const [sets, setSets] = useSetlists();
  const nav = useNavigate();
  const addToSet = (s: Setlist) => {
    if (!s.songIds.includes(GRID_SONG_ID)) setSets(all => all.map(x => (x.id === s.id ? { ...x, songIds: [...x.songIds, GRID_SONG_ID] } : x)));
    nav(`/scene/${s.id}`);
  };
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setStep(s => s + 1), GRID_BAR_MS);
    return () => clearInterval(t);
  }, [playing]);

  const chords = prog[sec];
  const updateSection = (fn: (p: Chord[]) => Chord[]) => setProg(all => all.map((p, i) => (i === sec ? fn(p) : p)));
  const shift = (n: number) => {
    setKey(k => mod12(k + n));
    setProg(all => all.map(p => p.map(c => ({ pc: mod12(c.pc + n), m: c.m }))));
  };
  const tapWheel = (pc: number, m: boolean) => {
    if (mode === 'key') setKey(m ? mod12(pc + 3) : pc);
    else updateSection(p => (p.length >= MAX_CHORDS ? p : [...p, { pc, m }]));
  };

  return (
    <Phone label="05 Grille">
      <StatusBar />
      <div className="screen-body" style={{ gap: 14 }}>
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/composer" />
            <div className="head-titles">
              <span className="kicker">Grille</span>
              <span className="display" style={{ fontSize: 24, letterSpacing: '.03em', whiteSpace: 'nowrap' }}>MINUIT SHUFFLE</span>
            </div>
          </div>
          <div className="transpose">
            <button onClick={() => shift(-1)} aria-label="Baisser d’un demi-ton">−</button>
            <span>½ ton</span>
            <button onClick={() => shift(1)} aria-label="Monter d’un demi-ton">+</button>
          </div>
        </div>

        <div className="seg" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
          {GRID_SECTIONS.map((l, i) => (
            <button key={l} className={i === sec ? 'on' : ''} onClick={() => { setSec(i); setStep(0); }}>{l}</button>
          ))}
        </div>

        <div className="hscroll slots">
          {chords.map((c, i) => {
            const on = playing && i === step % chords.length;
            return (
              <button key={i} className={'slot' + (on ? ' on' : '')} onClick={() => updateSection(p => p.filter((_, j) => j !== i))} aria-label={`Retirer ${chordName(c)}`}>
                <span className="slot-name">{chordName(c)}</span>
                <span className="slot-deg">{degreeOf(key, c.pc, c.m) || '—'}</span>
              </button>
            );
          })}
          {chords.length < MAX_CHORDS && (
            <button className="slot-add" onClick={() => setMode('add')} aria-label="Ajouter un accord">+</button>
          )}
        </div>

        <div className="seg seg-dim" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
          <button className={mode === 'add' ? 'on' : ''} onClick={() => setMode('add')}>Ajouter un accord</button>
          <button className={mode === 'key' ? 'on' : ''} onClick={() => setMode('key')}>Changer de ton</button>
        </div>

        <div className="wheel">
          {OUT_PC.map((pc, i) => {
            const a = ((i * 30 - 90) * Math.PI) / 180;
            return ([
              { m: false, cpc: pc, r: 128, sz: 46, fs: 15, name: OUT_N[i] },
              { m: true, cpc: mod12(pc + 9), r: 82, sz: 38, fs: 12, name: IN_N[i] },
            ]).map(w => {
              const deg = degreeOf(key, w.cpc, w.m);
              const tonic = !w.m && w.cpc === key;
              const cls = tonic ? ' tonic' : deg ? (w.m ? ' lit-min' : ' lit-maj') : '';
              return (
                <button
                  key={w.name}
                  className={'wheel-chord' + cls}
                  style={{ left: R + w.r * Math.cos(a) - w.sz / 2, top: R + w.r * Math.sin(a) - w.sz / 2, width: w.sz, height: w.sz }}
                  onClick={() => tapWheel(w.cpc, w.m)}
                >
                  <span className="wc-name" style={{ fontSize: w.fs }}>{w.name}</span>
                  <span className="wc-deg">{deg || ' '}</span>
                </button>
              );
            });
          })}
          <div className="wheel-hub">
            <span className="hub-kicker">TON</span>
            <span className="hub-key">{KFR[key]}</span>
            <span className="hub-rel">rel. {KFR[mod12(key + 9)]}m</span>
          </div>
        </div>
      </div>

      <div className="grid-actions">
        <button className={'cta grid-loop' + (playing ? ' on' : '')} onClick={() => { setPlaying(!playing); setStep(0); }}>
          {playing ? 'Arrêter la boucle' : '▶  Boucle · 92 BPM'}
        </button>
        <button className="grid-to-set" onClick={() => setPicking(true)}>Setlist +</button>
      </div>

      {picking && (
        <div className="sheet-backdrop" onClick={() => setPicking(false)}>
          <div className="set-sheet" role="dialog" aria-label="Ajouter à une setlist" onClick={e => e.stopPropagation()}>
            <div className="set-sheet-head">
              <span className="kicker" style={{ color: 'var(--amber)' }}>Ajouter « Minuit Shuffle » à…</span>
              <button className="player-close" onClick={() => setPicking(false)} aria-label="Fermer">✕</button>
            </div>
            {[...sets].sort((a, b) => a.date - b.date).map(s => {
              const inSet = s.songIds.includes(GRID_SONG_ID);
              return (
                <button key={s.id} className="pick-row" onClick={() => addToSet(s)}>
                  <div className="song-text">
                    <span className="song-title">{s.name}</span>
                    <span className="song-meta">{fmtDate(s.date)} · {titlesLabel(s.songIds.length)}</span>
                  </div>
                  {inSet ? <span className="in-set">Déjà dedans ›</span> : <span className="pick-plus">+</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <TabBar active={1} />
    </Phone>
  );
}
