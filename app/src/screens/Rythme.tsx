import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { deleteBlob } from '../lib/blobs';
import { GpError, readGuitarPro, type GpSong } from '../lib/guitarPro';
import { MetronomeEngine } from '../lib/metronome';
import { MODEL_RHYTHMS, barBeats, commonPatterns, slotsPerBeat, strokeText, type Rhythm, type StrumBar } from '../lib/strum';
import { strumPattern } from '../lib/strumPlay';
import { useStoredState } from '../lib/store';
import { useDialog } from '../lib/useDialog';
import { useMarkUsed } from '../lib/usage';
import './Rythme.css';

export const useRhythms = () => useStoredState<Rhythm[]>('rhythms', []);
const CHORDS = ['Em', 'Am', 'C', 'G', 'D', 'A', 'E'];
const newId = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
/** « 4/4 », « 6/8 »… from the first bar. */
export const meter = (r: { den: 4 | 8; bars: StrumBar[] }) => `${barBeats(r.bars[0]?.slots.length ?? 16, r.den)}/${r.den}`;

/** Pratiquer › Rythme: strumming patterns as arrows that scroll in time, from models, Guitar Pro files or typed scores. */
export default function Rythme() {
  useMarkUsed('rythme');
  const nav = useNavigate();
  const [mine, setMine] = useRhythms();
  const [currentId, setCurrentId] = useStoredState('rhythm.current', 'm-pop');
  const all = [...mine, ...MODEL_RHYTHMS];
  const current = all.find(r => r.id === currentId) ?? MODEL_RHYTHMS[0];
  const [gp, setGp] = useState<{ song: GpSong; track: number } | null>(null);
  const [gpError, setGpError] = useState('');
  const [gpBusy, setGpBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const dlgGp = useDialog(() => setGp(null));

  const openGp = async (f: File) => {
    setGpError(''); setGpBusy(true);
    try {
      const song = await readGuitarPro(new Uint8Array(await f.arrayBuffer()));
      if (!song.tracks.length) throw new GpError('Ce fichier ne contient aucune piste de guitare.');
      setGp({ song, track: 0 });
    } catch (e) {
      setGpError(e instanceof GpError ? e.message : 'Lecture impossible : le fichier est peut-être abîmé.');
    } finally { setGpBusy(false); }
  };

  const save = (r: Omit<Rhythm, 'id' | 'created'>) => {
    const full: Rhythm = { ...r, id: newId(), created: Date.now() };
    setMine(list => [full, ...list]);
    setCurrentId(full.id);
    setGp(null);
  };
  const remove = (id: string) => { setMine(list => list.filter(r => r.id !== id)); void deleteBlob(`rhythm-photo:${id}`); if (currentId === id) setCurrentId('m-pop'); };

  return (
    <Phone label="Rythme">
      <StatusBar />
      <div className="rythme-scroll">
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/pratiquer" />
            <div className="head-titles">
              <span className="kicker">Pratiquer</span>
              <h1 className="display" style={{ fontSize: 28 }}>RYTHME</h1>
            </div>
          </div>
        </div>

        <Player key={current.id} rhythm={current} onBpm={bpm => mine.some(r => r.id === current.id) && setMine(list => list.map(r => (r.id === current.id ? { ...r, bpm } : r)))} />

        <div className="rythme-actions">
          <button className="btn-outline" disabled={gpBusy} onClick={() => file.current?.click()}>{gpBusy ? 'Lecture du fichier…' : '🎼 Importer un fichier Guitar Pro'}</button>
          <button className="btn-outline" onClick={() => nav('/pratiquer/rythme/saisie')}>✍︎ Recopier une partition</button>
          <input ref={file} type="file" hidden accept=".gp,.gp3,.gp4,.gp5,.gpx,.gp7" aria-label="Fichier Guitar Pro"
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void openGp(f); }} />
        </div>
        {gpError && <p className="rythme-error" role="alert">{gpError}</p>}

        {mine.length > 0 && <span className="kicker rythme-kicker">Mes rythmes</span>}
        {mine.map(r => (
          <RhythmRow key={r.id} r={r} on={r.id === current.id} onPick={() => setCurrentId(r.id)}
            onEdit={r.notes ? () => nav(`/pratiquer/rythme/saisie?id=${r.id}`) : undefined} onDelete={() => remove(r.id)} />
        ))}
        <span className="kicker rythme-kicker">Modèles</span>
        {MODEL_RHYTHMS.map(r => <RhythmRow key={r.id} r={r} on={r.id === current.id} onPick={() => setCurrentId(r.id)} />)}
      </div>

      {gp && (
        <div className="sheet-backdrop" onClick={() => setGp(null)}>
          <div className="set-sheet gp-sheet" ref={dlgGp} role="dialog" aria-label="Importer depuis Guitar Pro" onClick={e => e.stopPropagation()}>
            <div className="set-sheet-head">
              <span className="kicker sheet-kicker">{gp.song.title}{gp.song.artist ? ` · ${gp.song.artist}` : ''}</span>
              <button className="player-close" onClick={() => setGp(null)} aria-label="Fermer">✕</button>
            </div>
            <GpChoice song={gp.song} track={gp.track} onTrack={t => setGp({ ...gp, track: t })} onSave={save} />
          </div>
        </div>
      )}
      <TabBar active={2} />
    </Phone>
  );
}

function RhythmRow({ r, on, onPick, onEdit, onDelete }: { r: Rhythm; on: boolean; onPick: () => void; onEdit?: () => void; onDelete?: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className={'rhythm-row' + (on ? ' on' : '')}>
      <button className="rhythm-pick" onClick={onPick} aria-pressed={on}>
        <span className="rhythm-name">{r.name}</span>
        <span className="rhythm-meta mono">{meter(r)} · {r.bpm} BPM{r.swing ? ' · swing' : ''} · {r.bars.length} mes.</span>
        <span className="rhythm-arrows mono" aria-hidden>{strokeText(r.bars[0].slots)}</span>
      </button>
      {onEdit && <button className="rhythm-btn" onClick={onEdit} aria-label={`Modifier ${r.name}`}>✎</button>}
      {onDelete && (confirm
        ? <button className="rhythm-btn danger" onClick={onDelete} aria-label={`Confirmer la suppression de ${r.name}`}>Suppr.</button>
        : <button className="rhythm-btn" onClick={() => setConfirm(true)} aria-label={`Supprimer ${r.name}`}>✕</button>)}
    </div>
  );
}

/** After reading a Guitar Pro file: which track, then the whole song or one of its patterns. */
function GpChoice({ song, track, onTrack, onSave }: { song: GpSong; track: number; onTrack: (i: number) => void; onSave: (r: Omit<Rhythm, 'id' | 'created'>) => void }) {
  const t = song.tracks[track];
  const patterns = useMemo(() => commonPatterns(t.bars).slice(0, 4), [t]);
  const base = { den: song.den, bpm: song.bpm, swing: song.swing || undefined, source: 'gp' as const };
  const chords = [...new Set(t.bars.map(b => b.chord).filter(Boolean))].slice(0, 8);
  return (
    <>
      {song.tracks.length > 1 && (
        <label className="sheet-field">
          <span>Piste</span>
          <select className="text-input" value={track} onChange={e => onTrack(Number(e.target.value))}>
            {song.tracks.map((x, i) => <option key={x.index} value={i}>{x.name}{x.chordShare > 0.5 ? ' (rythmique)' : ''}</option>)}
          </select>
        </label>
      )}
      <p className="gp-info">{t.bars.length} mesures · {song.bpm} BPM{song.swing ? ' · swing' : ''}{chords.length ? ` · ${chords.join(' ')}` : ''}</p>
      {t.rounded && <p className="gp-info warn">Certaines notes (triolets) tombent entre deux doubles croches : elles sont arrondies.</p>}
      <div className="gp-list">
        <button className="gp-option" onClick={() => onSave({ ...base, name: `${song.title} · ${t.name}`, bars: t.bars })}>
          <span className="rhythm-name">Tout le morceau</span>
          <span className="rhythm-meta">{t.bars.length} mesures, avec les accords</span>
        </button>
        {patterns.map((p, i) => (
          <button key={i} className="gp-option" onClick={() => onSave({ ...base, name: `${song.title} · motif ${i + 1}`, bars: [{ slots: p.bar.slots, chord: t.bars[p.first].chord }] })}>
            <span className="rhythm-name">Motif {i + 1} <span className="rhythm-meta">· {p.count} mesure{p.count > 1 ? 's' : ''}</span></span>
            <span className="rhythm-arrows mono">{strokeText(p.bar.slots)}</span>
          </button>
        ))}
      </div>
    </>
  );
}

const CELL = 24;
const COUNTS_4 = ['', 'e', '&', 'a'];

/** The arrows scroll under a fixed line; the stroke on the line is the one to play. */
function Player({ rhythm, onBpm }: { rhythm: Rhythm; onBpm: (bpm: number) => void }) {
  const [bpm, setBpm] = useState(rhythm.bpm);
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useStoredState<'strum' | 'click'>('rhythm.sound', 'strum');
  const [chord, setChord] = useStoredState('rhythm.chord', 'Em');
  const [at, setAt] = useState({ bar: 0, slot: -1 });
  const track = useRef<HTMLDivElement>(null);
  const engine = useRef<MetronomeEngine | null>(null);
  const t0 = useRef(0);
  const live = useRef({ bpm, sound, chord });
  live.current = { bpm, sound, chord };
  const hasChords = rhythm.bars.some(b => b.chord);
  const den = rhythm.den;
  const sps = slotsPerBeat(den) * (den === 8 ? 3 : 1); // slots per counted pulse
  const starts = useMemo(() => rhythm.bars.reduce<number[]>((a, _b, i) => [...a, i ? a[i - 1] + rhythm.bars[i - 1].slots.length : 0], []), [rhythm]);
  const total = rhythm.bars.reduce((s, b) => s + b.slots.length, 0);
  const slotSec = () => 60 / live.current.bpm / sps;
  const cache = useRef<{ sig: string; p: ReturnType<typeof strumPattern> } | null>(null);

  if (!engine.current) {
    engine.current = new MetronomeEngine(() => {
      const { bpm: b, sound: s, chord: c } = live.current;
      const sig = JSON.stringify([b, s, c]);
      if (cache.current?.sig !== sig) cache.current = { sig, p: strumPattern(rhythm.bars, { bpm: b, den, swing: rhythm.swing, click: true, strum: s === 'strum', fallbackChord: c }) };
      return cache.current.p;
    }, (slot, bar) => setAt({ bar, slot }));
  }
  useEffect(() => () => engine.current?.dispose(), []);

  // The lane moves smoothly with the clock; the strokes light up as the engine plays them.
  useEffect(() => {
    if (!playing) { if (track.current) track.current.style.transform = 'translateX(0px)'; return; }
    let raf = 0;
    const frame = () => {
      const pos = Math.max(0, (performance.now() - t0.current) / 1000 / slotSec());
      if (track.current) track.current.style.transform = `translateX(${-(pos % total) * CELL}px)`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, total]);

  const toggle = () => {
    const e = engine.current!;
    if (e.running) { e.stop(); setPlaying(false); setAt({ bar: 0, slot: -1 }); return; }
    cache.current = null;
    e.start();
    t0.current = performance.now() + 60; // the engine starts 60 ms ahead
    setPlaying(true);
  };
  const changeBpm = (d: number) => {
    const b = Math.max(30, Math.min(220, bpm + d));
    // Keep the lane in place when the tempo changes while playing.
    if (playing) { const pos = (performance.now() - t0.current) / 1000 / slotSec(); t0.current = performance.now() - pos * (60 / b / sps) * 1000; }
    setBpm(b); onBpm(b);
  };

  // Two passes of the rhythm, so the lane never runs out (it loops by itself).
  const passes = total < 64 ? 3 : 2;
  const cells: { s: string; i: number; bar: number; slot: number; pass: number; key: string }[] = [];
  for (let p = 0; p < passes; p++) rhythm.bars.forEach((b, bi) => b.slots.forEach((s, si) => cells.push({ s, i: p * total + starts[bi] + si, bar: bi, slot: si, pass: p, key: `${p}-${bi}-${si}` })));
  const curBar = rhythm.bars[at.bar];

  return (
    <div className="rhythm-player card">
      <div className="rp-head">
        <div className="rp-title">
          <span className="rhythm-name">{rhythm.name}</span>
          <span className="rhythm-meta mono">{meter(rhythm)}{rhythm.swing ? ' · swing' : ''} · mesure {at.slot >= 0 ? at.bar + 1 : 1}/{rhythm.bars.length}</span>
        </div>
        {(curBar?.chord ?? (!hasChords ? chord : null)) && <span className="rp-chord">{curBar?.chord ?? chord}</span>}
      </div>

      <div className="rp-lane" aria-hidden>
        <div className="rp-line" />
        <div className="rp-track" ref={track}>
          {cells.map(c => {
            const beatStart = c.slot % sps === 0, eighth = c.slot % 2 === 0;
            // The lane is drawn twice or more to loop; the copy under the line is the first one.
            const lit = playing && c.pass === 0 && c.bar === at.bar && c.slot === at.slot;
            return (
              <div key={c.key} className={'rp-cell' + (c.slot === 0 ? ' bar' : '') + (beatStart ? ' beat' : '')} style={{ left: c.i * CELL }}>
                {c.s !== '-' && <span className={'rp-stroke ' + (c.s === 'D' ? 'down' : 'up') + (lit ? ' lit' : '')}>{c.s === 'D' ? '↓' : '↑'}</span>}
                {c.slot === 0 && rhythm.bars[c.bar].chord && <span className="rp-cell-chord">{rhythm.bars[c.bar].chord}</span>}
                <span className="rp-count mono">{den === 8 ? (eighth ? String(c.slot / 2 + 1) : '') : beatStart ? String(c.slot / 4 + 1) : COUNTS_4[c.slot % 4]}</span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="sr-only" role="status">{playing && at.slot >= 0 ? `Mesure ${at.bar + 1}` : ''}</p>

      <div className="rp-controls">
        <button className={'rp-play' + (playing ? ' on' : '')} onClick={toggle} aria-label={playing ? 'Arrêter' : 'Jouer le rythme'}>{playing ? '■' : '▶'}</button>
        <div className="mini-stepper">
          <button onClick={() => changeBpm(-4)} aria-label="Ralentir">−</button>
          <span className="mono">{bpm} BPM</span>
          <button onClick={() => changeBpm(4)} aria-label="Accélérer">+</button>
        </div>
      </div>
      <div className="seg" role="group" aria-label="Son" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
        <button className={sound === 'strum' ? 'on' : ''} aria-pressed={sound === 'strum'} onClick={() => setSound('strum')}>Grattage + clic</button>
        <button className={sound === 'click' ? 'on' : ''} aria-pressed={sound === 'click'} onClick={() => setSound('click')}>Clic seul</button>
      </div>
      {!hasChords && sound === 'strum' && (
        <div className="hscroll rp-chords" role="group" aria-label="Accord joué">
          {CHORDS.map(c => <button key={c} className={'chip' + (c === chord ? ' on-amber' : '')} aria-pressed={c === chord} onClick={() => setChord(c)}>{c}</button>)}
        </div>
      )}
      {rhythm.bars.length > 1 && (
        <div className="rp-bars">
          {rhythm.bars.slice(0, 64).map((b, i) => (
            <span key={i} className={'rp-bar mono' + (playing && i === at.bar ? ' on' : '')}>
              {b.chord && <b>{b.chord}</b>}{strokeText(b.slots)}
            </span>
          ))}
          {rhythm.bars.length > 64 && <span className="rp-bar mono">… {rhythm.bars.length - 64} de plus</span>}
        </div>
      )}
    </div>
  );
}
