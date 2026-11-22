import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { playLick, playUrl, type Playback } from '../lib/audio';
import { buildBacking } from '../lib/backing';
import { getBlob } from '../lib/blobs';
import {
  GRID_BPM, GRID_GROOVES, GRID_MAX_CHORDS, GRID_SECTIONS, gridSongId, grooveDef, readGrids, type Grid,
} from '../lib/grids';
import { INITIAL_IDEAS, type Idea } from '../lib/ideas';
import { MetronomeEngine, type Pattern } from '../lib/metronome';
import { IN_N, KFR, OUT_N, OUT_PC, chordName, chordTypeId, degreeOf, mod12, type Chord } from '../lib/music';
import { romanOf } from '../lib/suggest';
import { ROLES, regenerateSection, seeded, styleDef } from '../lib/generate';
import { SuggestPanel } from '../components/SuggestPanel';
import { fmtDate, titlesLabel, type Setlist } from '../lib/setlists';
import { GridChordSheet } from '../components/GridChordSheet';
import { usePedal } from '../lib/pedal';
import { readStored } from '../lib/store';
import { useGrids, useSetlists } from '../lib/hooks';
import './Grille.css';
import { useDialog } from '../lib/useDialog';
import { markUsed } from '../lib/usage';

const R = 159; // wheel radius (318 / 2)


/** /composer/grille/:gridId — the old /composer/grille opens the first grid. */
export default function GrilleRoute() {
  const { gridId } = useParams();
  const grids = readGrids();
  if (!gridId) return <Navigate to={grids[0] ? `/composer/grille/${grids[0].id}` : '/composer/grilles'} replace />;
  if (!grids.some(g => g.id === gridId)) return <Navigate to="/composer/grilles" replace />;
  return <Grille key={gridId} id={gridId} />;
}

function loopPattern(g: Grid, chords: Chord[]): Pattern {
  return buildBacking({
    id: g.id, name: g.title, style: grooveDef(g.groove).style, groove: g.groove, key: g.key, bpm: g.bpm, form: '',
    bars: chords.map(c => ({ deg: mod12(c.pc - g.key), q: chordTypeId(c) })),
  }, g.key, g.bpm);
}

function Grille({ id }: { id: string }) {
  const nav = useNavigate();
  const [grids, setGrids] = useGrids();
  const g = grids.find(x => x.id === id);
  const [sec, setSec] = useState(0);
  const [mode, setMode] = useState<'add' | 'key'>('add');
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState({ bar: 0, beat: -1 });
  const [sheet, setSheet] = useState<null | 'settings' | 'setlist'>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** Chord of the section shown in the diagram sheet. */
  const [chordAt, setChordAt] = useState<number | null>(null);
  const dlgSet = useDialog(() => closeSheet());
  const dlgSettings = useDialog(() => closeSheet());
  const [sets, setSets] = useSetlists();
  const riffPlayer = useRef<Playback | null>(null);
  const [riffPlaying, setRiffPlaying] = useState(false);

  // Loop engine: reads the current grid and section on every step.
  const live = useRef({ g, sec });
  live.current = { g, sec };
  const cache = useRef<{ sig: string; p: Pattern } | null>(null);
  const engine = useRef<MetronomeEngine | null>(null);
  if (!engine.current) {
    engine.current = new MetronomeEngine(() => {
      const { g: cur, sec: s } = live.current;
      const chords = cur!.prog[s];
      const sig = JSON.stringify([s, cur!.key, cur!.bpm, cur!.groove, chords]);
      if (cache.current?.sig !== sig) cache.current = { sig, p: loopPattern(cur!, chords) };
      return cache.current.p;
    }, (beat, bar) => setPos({ bar, beat }));
  }
  useEffect(() => () => { engine.current?.dispose(); riffPlayer.current?.stop(); }, []);

  const chords = g?.prog[sec] ?? [];
  // Nothing left to play in this section: stop.
  useEffect(() => {
    if (playing && !chords.length) { engine.current!.stop(); setPlaying(false); }
  }, [playing, chords.length]);

  // Pedal: loop on / off; left pedal moves to the next section that has chords.
  const loopPedal = () => { if (chords.length) toggleLoop(); };
  usePedal({
    right: loopPedal,
    middle: loopPedal,
    left: () => {
      if (!g) return;
      const n = GRID_SECTIONS.length;
      for (let k = 1; k < n; k++) {
        const i = (sec + k) % n;
        if (g.prog[i]?.length) { pickSection(i); return; }
      }
    },
  });

  if (!g) return <Navigate to="/composer/grilles" replace />;

  const update = (fn: (x: Grid) => Grid) => setGrids(all => all.map(x => (x.id === id ? fn(x) : x)));
  const updateSection = (fn: (p: Chord[]) => Chord[]) => update(x => ({ ...x, prog: x.prog.map((p, i) => (i === sec ? fn(p) : p)) }));
  const shift = (n: number) => update(x => ({ ...x, key: mod12(x.key + n), prog: x.prog.map(p => p.map(c => ({ ...c, pc: mod12(c.pc + n) }))) }));
  const tapWheel = (pc: number, m: boolean) => {
    if (mode === 'key') update(x => ({ ...x, key: m ? mod12(pc + 3) : pc }));
    else updateSection(p => (p.length >= GRID_MAX_CHORDS ? p : [...p, { pc, m }]));
  };
  const toggleLoop = () => {
    const e = engine.current!;
    if (playing) { e.stop(); setPlaying(false); setPos({ bar: 0, beat: -1 }); return; }
    e.rewind(); setPos({ bar: 0, beat: -1 }); e.start(); setPlaying(true); markUsed('grilles');
  };
  const pickSection = (i: number) => { setSec(i); setChordAt(null); setPos({ bar: 0, beat: -1 }); engine.current!.rewind(); };
  const removeChord = (i: number) => {
    updateSection(p => p.filter((_, j) => j !== i));
    const left = chords.length - 1;
    setChordAt(left ? Math.min(i, left - 1) : null);
  };

  const regenerate = () => {
    if (!g.style) return;
    updateSection(p => regenerateSection(g.key, g.style!, ROLES[sec], p, seeded(Date.now())));
  };
  const toggleLock = (i: number) => updateSection(p => p.map((c, j) => (j === i ? { ...c, lock: c.lock ? undefined : true } : c)));
  const locked = chords.filter(c => c.lock).length;

  const songId = gridSongId(g);
  const addToSet = (s: Setlist) => {
    if (!s.songIds.includes(songId)) setSets(all => all.map(x => (x.id === s.id ? { ...x, songIds: [...x.songIds, songId] } : x)));
    nav(`/scene/${s.id}`);
  };

  const idea = g.ideaId ? readStored<Idea[]>('ideas', INITIAL_IDEAS).find(i => i.id === g.ideaId) : undefined;
  const playRiff = async () => {
    riffPlayer.current?.stop(); riffPlayer.current = null;
    if (riffPlaying || !idea) { setRiffPlaying(false); return; }
    const end = () => { riffPlayer.current = null; setRiffPlaying(false); };
    if (idea.lick) riffPlayer.current = playLick(idea.lick, idea.bpm ?? g.bpm, end);
    else if (idea.hasAudio) {
      const blob = await getBlob(idea.id);
      if (!blob) return;
      riffPlayer.current = playUrl(URL.createObjectURL(blob), end);
    } else return;
    setRiffPlaying(true);
  };

  const remove = () => {
    engine.current!.stop();
    setGrids(all => all.filter(x => x.id !== id));
    // A grid that was its own song leaves the setlists with it.
    if (!g.songId) setSets(all => all.map(s => ({ ...s, songIds: s.songIds.filter(x => x !== songId) })));
    nav('/composer/grilles', { replace: true });
  };

  const closeSheet = () => { setSheet(null); setConfirmDelete(false); riffPlayer.current?.stop(); setRiffPlaying(false); };

  return (
    <Phone label="05 Grille" wide>
      <StatusBar />
      <div className="screen-body grid-body" style={{ gap: 14 }}>
        <h1 className="sr-only">Grille : {g.title}</h1>
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/composer/grilles" />
            <button className="head-titles grid-head" onClick={() => setSheet('settings')} aria-label="Réglages de la grille">
              <span className="kicker grid-kicker">{g.bpm} BPM · {grooveDef(g.groove).label} ▾</span>
              <span className="display grid-title">{g.title.toUpperCase()}</span>
            </button>
          </div>
          <div className="transpose">
            <button onClick={() => shift(-1)} aria-label="Baisser d’un demi-ton">−</button>
            <span>½ ton</span>
            <button onClick={() => shift(1)} aria-label="Monter d’un demi-ton">+</button>
          </div>
        </div>

        <div className="seg" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
          {GRID_SECTIONS.map((l, i) => (
            <button key={l} className={i === sec ? 'on' : ''} onClick={() => pickSection(i)}>
              {l}{g.prog[i].length ? '' : ' ·'}
            </button>
          ))}
        </div>

        {g.style && (
          <div className="regen-row">
            <button className="regen-btn" onClick={regenerate}>🎲 Une autre version du {GRID_SECTIONS[sec].toLowerCase()}</button>
            <span className="regen-hint">{styleDef(g.style).label}{locked ? ` · ${locked} gardé${locked > 1 ? 's' : ''}` : ''}</span>
          </div>
        )}

        <div className="hscroll slots">
          {chords.map((c, i) => {
            const on = playing && i === pos.bar;
            return (
              <button key={i} className={'slot' + (on ? ' on' : '')} onClick={() => setChordAt(i)} aria-label={`Accord ${chordName(c)} : diagramme`}>
                <span className="slot-name">{chordName(c)}</span>
                {c.lock && <span className="slot-lock" aria-label="gardé">🔒</span>}
                <span className="slot-deg">{(!c.x && degreeOf(g.key, c.pc, c.m)) || romanOf(g.key, c)}</span>
              </button>
            );
          })}
          {!chords.length && <span className="slots-empty">Touchez un accord sur la roue pour commencer</span>}
          {chords.length > 0 && chords.length < GRID_MAX_CHORDS && (
            <button className="slot-add" onClick={() => setMode('add')} aria-label="Ajouter un accord">+</button>
          )}
        </div>

        <SuggestPanel gridKey={g.key} chords={chords} bpm={g.bpm} room={GRID_MAX_CHORDS - chords.length}
          onAdd={add => updateSection(p => [...p, ...add].slice(0, GRID_MAX_CHORDS))} />

        <div className="seg seg-dim" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
          <button className={mode === 'add' ? 'on' : ''} onClick={() => setMode('add')}>Ajouter un accord</button>
          <button className={mode === 'key' ? 'on' : ''} onClick={() => setMode('key')}>Changer de ton</button>
        </div>

        <div className="wheel" data-theme="dark">
          {OUT_PC.map((pc, i) => {
            const a = ((i * 30 - 90) * Math.PI) / 180;
            return ([
              { m: false, cpc: pc, r: 128, sz: 46, fs: 15, name: OUT_N[i] },
              { m: true, cpc: mod12(pc + 9), r: 82, sz: 38, fs: 12, name: IN_N[i] },
            ]).map(w => {
              const deg = degreeOf(g.key, w.cpc, w.m);
              const tonic = !w.m && w.cpc === g.key;
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
            <span className="hub-key">{KFR[g.key]}</span>
            <span className="hub-rel">rel. {KFR[mod12(g.key + 9)]}m</span>
          </div>
        </div>
      </div>

      <div className="grid-actions">
        <button className={'cta grid-loop' + (playing ? ' on' : '')} onClick={toggleLoop} disabled={!chords.length}>
          {playing ? `Arrêter · ${GRID_SECTIONS[sec].toLowerCase()}` : `▶  Boucle · ${g.bpm} BPM`}
        </button>
        <button className="grid-to-set" onClick={() => setSheet('setlist')}>Setlist +</button>
      </div>

      {chordAt !== null && chords[chordAt] && (
        <GridChordSheet chords={chords} index={chordAt} gridKey={g.key} section={GRID_SECTIONS[sec]}
          onIndex={setChordAt} onRemove={removeChord} onClose={() => setChordAt(null)} onLock={g.style ? toggleLock : undefined} />
      )}

      {sheet === 'setlist' && (
        <div className="sheet-backdrop" onClick={closeSheet}>
          <div className="set-sheet" ref={dlgSet} role="dialog" aria-label="Ajouter à une setlist" onClick={e => e.stopPropagation()}>
            <div className="set-sheet-head">
              <span className="kicker sheet-kicker">Ajouter « {g.title} » à…</span>
              <button className="player-close" onClick={closeSheet} aria-label="Fermer">✕</button>
            </div>
            {[...sets].sort((a, b) => a.date - b.date).map(s => {
              const inSet = s.songIds.includes(songId);
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
            {!sets.length && <p className="sheet-empty">Aucune setlist. Créez-en une dans l’onglet Scène.</p>}
          </div>
        </div>
      )}

      {sheet === 'settings' && (
        <div className="sheet-backdrop" onClick={closeSheet}>
          <div className="set-sheet" ref={dlgSettings} role="dialog" aria-label="Réglages de la grille" onClick={e => e.stopPropagation()}>
            <div className="set-sheet-head">
              <span className="kicker sheet-kicker">Réglages de la grille</span>
              <button className="player-close" onClick={closeSheet} aria-label="Fermer">✕</button>
            </div>
            <label className="sheet-field">
              <span>Nom</span>
              <input className="text-input" value={g.title} maxLength={40}
                onChange={e => update(x => ({ ...x, title: e.target.value }))}
                onBlur={e => !e.target.value.trim() && update(x => ({ ...x, title: 'Sans titre' }))} />
            </label>
            <div className="sheet-field row">
              <span>Tempo</span>
              <div className="mini-stepper">
                <button onClick={() => update(x => ({ ...x, bpm: Math.max(GRID_BPM.min, x.bpm - 2) }))} aria-label="Ralentir">−</button>
                <span className="mono">{g.bpm} BPM</span>
                <button onClick={() => update(x => ({ ...x, bpm: Math.min(GRID_BPM.max, x.bpm + 2) }))} aria-label="Accélérer">+</button>
              </div>
            </div>
            <div className="sheet-field">
              <span>Groove de la boucle</span>
              <div className="seg" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
                {GRID_GROOVES.map(x => (
                  <button key={x.id} className={g.groove === x.id ? 'on' : ''} onClick={() => update(y => ({ ...y, groove: x.id }))}>{x.label}</button>
                ))}
              </div>
            </div>
            <div className="sheet-field">
              <span>Riff de départ</span>
              {idea ? (
                <div className="riff-row">
                  <button className={'idea-play' + (riffPlaying ? ' on' : '')} onClick={() => void playRiff()} aria-label={riffPlaying ? 'Arrêter le riff' : 'Écouter le riff'}>
                    {riffPlaying ? '❚❚' : '▶'}
                  </button>
                  <span className="riff-title">{idea.title}</span>
                  <button className="riff-unlink" onClick={() => update(x => ({ ...x, ideaId: undefined }))}>Délier</button>
                </div>
              ) : (
                <p className="sheet-empty">Aucun riff relié. Dans le carnet, ouvrez un riff et touchez « Ajouter à une grille ».</p>
              )}
            </div>
            <button className="btn-outline" onClick={() => nav('/pratiquer/looper', { state: { bpm: g.bpm, key: g.key, title: g.title } })}>Jouer par-dessus dans le looper ›</button>
            {confirmDelete ? (
              <div className="confirm-row">
                <button className="btn-outline" onClick={() => setConfirmDelete(false)}>Annuler</button>
                <button className="btn-danger" onClick={remove}>Supprimer</button>
              </div>
            ) : (
              <button className="btn-outline danger" onClick={() => setConfirmDelete(true)}>Supprimer la grille…</button>
            )}
          </div>
        </div>
      )}
      <TabBar active={1} />
    </Phone>
  );
}
