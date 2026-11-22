import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { bestCapo, capoOptions, signedShift } from '../lib/capo';
import { useSongs } from '../lib/hooks';
import { KEY_FR, mod12 } from '../lib/music';
import { hzToMidi } from '../lib/pitch';
import { readStored, useStoredState, writeStored } from '../lib/store';
import { useMicPitch } from '../lib/useMicPitch';
import { DEFAULT_RANGE, MELODIES, buildTimeline, noteFr, noteSci, voiceType, type VoiceRange } from '../lib/voice';
import { MicMessage } from './Voix';
import './Voix.css';
import { useMarkUsed } from '../lib/usage';

const KB_LO = 36, KB_HI = 84; // C2–C6 on the range bar
const pct = (m: number) => ((m - KB_LO) / (KB_HI - KB_LO)) * 100;
const MEASURE_S = 3;

/** Horizontal C2–C6 bar with the singer's range (and optionally a melody's) highlighted. */
export function RangeBar({ range, melody }: { range: { low: number; high: number }; melody?: { low: number; high: number } }) {
  return (
    <div className="range-bar" aria-hidden>
      {[36, 48, 60, 72, 84].map(c => <span key={c} className="range-tick" style={{ left: `${pct(c)}%` }}>{noteFr(c)}</span>)}
      <div className="range-fill" style={{ left: `${pct(range.low)}%`, width: `${pct(range.high) - pct(range.low)}%` }} />
      {melody && <div className={'range-mel' + (melody.low < range.low || melody.high > range.high ? ' out' : '')} style={{ left: `${pct(melody.low)}%`, width: `${Math.max(1.5, pct(melody.high) - pct(melody.low))}%` }} />}
    </div>
  );
}

/* ---------- Tessiture ---------- */

export function Tessiture() {
  const nav = useNavigate();
  const [range, setRange] = useStoredState<VoiceRange>('voice.range', DEFAULT_RANGE);
  const [measuring, setMeasuring] = useState<null | 'low' | 'high'>(null);
  const [live, setLive] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const samples = useRef<{ t: number; m: number }[]>([]);
  const startAt = useRef<number | null>(null);

  const done = (which: 'low' | 'high') => {
    const ms = samples.current.map(s => s.m).sort((a, b) => a - b);
    setMeasuring(null); setLive(null); setProgress(0);
    if (ms.length < 12) { setMsg('Je n’ai pas assez entendu de voix. Tenez la note plus longtemps, plus fort.'); return; }
    const note = Math.round(ms[Math.floor(ms.length / 2)]);
    setRange(r => {
      const next = { ...r, [which]: note, measured: true };
      if (next.low >= next.high) { if (which === 'low') next.high = next.low + 12; else next.low = next.high - 12; }
      return next;
    });
    setMsg(`${which === 'low' ? 'Note grave' : 'Note aiguë'} : ${noteFr(note)} (${noteSci(note)}).`);
  };

  const mic = useMicPitch((hz, _lv, time) => {
    if (!measuring) return;
    if (hz === null) { setLive(null); return; }
    const m = hzToMidi(hz);
    setLive(m);
    if (startAt.current === null) startAt.current = time;
    samples.current.push({ t: time, m });
    const p = (time - startAt.current) / MEASURE_S;
    setProgress(Math.min(1, p));
    if (p >= 1) done(measuring);
  }, measuring !== null);

  const measure = (which: 'low' | 'high') => { samples.current = []; startAt.current = null; setMsg(null); setProgress(0); setMeasuring(which); };
  const nudge = (which: 'low' | 'high', d: number) => setRange(r => {
    const next = { ...r, [which]: r[which] + d, measured: true };
    return next.low < next.high ? next : r;
  });

  const side = (which: 'low' | 'high', label: string, hint: string) => (
    <div className={'tess-card' + (measuring === which ? ' on' : '')}>
      <span className="tess-label">{label}</span>
      {measuring === which ? (
        <>
          <span className="tess-note live">{live !== null ? noteFr(Math.round(live)) : '…'}</span>
          <div className="tess-progress"><div style={{ width: `${progress * 100}%` }} /></div>
          <span className="tess-hint">{live === null ? hint : 'Tenez la note…'}</span>
          <button className="btn-outline" onClick={() => { setMeasuring(null); setLive(null); }}>Annuler</button>
        </>
      ) : (
        <>
          <span className="tess-note">{noteFr(range[which])}<small className="mono"> {noteSci(range[which])}</small></span>
          <div className="mini-stepper">
            <button onClick={() => nudge(which, -1)} aria-label={`${label} : un demi-ton plus bas`}>−</button>
            <span className="mono">½ ton</span>
            <button onClick={() => nudge(which, 1)} aria-label={`${label} : un demi-ton plus haut`}>+</button>
          </div>
          <button className="btn-outline" onClick={() => measure(which)} disabled={measuring !== null}>● Mesurer</button>
        </>
      )}
    </div>
  );

  return (
    <Phone label="10g Tessiture">
      <StatusBar />
      <div className="voice-scroll">
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/voix" />
            <div className="head-titles">
              <span className="kicker">Justesse vocale</span>
              <h1 className="display" style={{ fontSize: 28 }}>MA TESSITURE</h1>
            </div>
          </div>
        </div>
        <div className="tess-summary">
          <div className="tess-sum-top">
            <b>{range.measured ? voiceType(range) : 'Pas encore mesurée'}</b>
            <span className="mono">{range.high - range.low} demi-tons · {((range.high - range.low) / 12).toFixed(1).replace('.', ',')} octave{range.high - range.low >= 24 ? 's' : ''}</span>
          </div>
          <RangeBar range={range} />
          <span className="tess-note-small">Type de voix indicatif, d’après le milieu de votre tessiture.</span>
        </div>
        {measuring && <MicMessage state={mic.state} retry={mic.retry} />}
        <div className="tess-grid">
          {side('low', 'Note la plus grave', 'Chantez votre note la plus grave et tenez-la 3 s')}
          {side('high', 'Note la plus aiguë', 'Chantez votre note la plus aiguë (sans forcer) et tenez-la 3 s')}
        </div>
        {msg && <p className="voice-note">{msg}</p>}
      </div>
      <button className="cta" onClick={() => nav('/voix/tonalite')}>Trouver ma tonalité ›</button>
      <TabBar active={2} />
    </Phone>
  );
}

/* ---------- Trouver ma tonalité ---------- */

interface Fit { shift: number; key: number; low: number; high: number; overflow: number }

/** Transposition (−12…+12) that puts the melody inside the range with a semitone of margin, close to its centre. */
export function fitMelody(r: { low: number; high: number }, mel: { low: number; high: number }, key: number): Fit {
  let best: Fit & { cost: number } | null = null;
  for (let t = -12; t <= 12; t++) {
    const lo = mel.low + t, hi = mel.high + t;
    const overflow = Math.max(0, r.low + 1 - lo) + Math.max(0, hi - (r.high - 1));
    const centre = Math.abs((lo + hi) / 2 - ((r.low + r.high) / 2 - 1));
    const cost = overflow * 10 + centre * 0.3 + Math.abs(signedShift(t)) * 0.08 + (Math.abs(t) > 6 ? 0.4 : 0);
    if (!best || cost < best.cost) best = { shift: t, key: mod12(key + t), low: lo, high: hi, overflow, cost };
  }
  return best!;
}

interface Candidate { id: string; title: string; key: number; minor?: boolean; low: number; high: number; songId?: string }

export function Tonalite() {
  useMarkUsed('tonalite'); // a reference tool: opening it is using it
  const nav = useNavigate();
  const range = readStored<VoiceRange>('voice.range', DEFAULT_RANGE);
  const [songs, setSongs] = useSongs();
  const [open, setOpen] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  const cands: Candidate[] = [
    ...songs.filter(s => s.melodyLow != null && s.melodyHigh != null)
      .map(s => ({ id: s.id, title: s.title, key: s.key, minor: s.minor, low: s.melodyLow!, high: s.melodyHigh!, songId: s.id })),
    ...MELODIES.map(m => {
      const tl = buildTimeline(m, 60);
      const ms = tl.targets.map(t => t.midi);
      return { id: m.id, title: m.title, key: 0, low: Math.min(...ms), high: Math.max(...ms) };
    }),
  ];
  const noMelody = songs.filter(s => s.melodyLow == null).length;

  const apply = (c: Candidate, fit: Fit) => {
    if (!c.songId) return;
    const cap = bestCapo(fit.key, c.minor);
    // Stage shows the chord shapes to play; the capo makes them sound in the new key.
    writeStored(`stage.trans.${c.songId}`, signedShift(cap.shapes - c.key));
    setSongs(all => all.map(s => (s.id === c.songId ? { ...s, capo: cap.capo } : s)));
    setApplied(c.id);
  };

  return (
    <Phone label="10h Tonalité">
      <StatusBar />
      <div className="voice-scroll">
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/voix/tessiture" />
            <div className="head-titles">
              <span className="kicker">Tessiture {noteFr(range.low)} – {noteFr(range.high)}</span>
              <h1 className="display" style={{ fontSize: 26, whiteSpace: 'nowrap' }}>TROUVER MA TONALITÉ</h1>
            </div>
          </div>
        </div>
        {!range.measured && (
          <div className="mic-banner">Tessiture non mesurée : les résultats utilisent une tessiture moyenne.
            <button className="mic-retry" onClick={() => nav('/voix/tessiture')}>Mesurer</button>
          </div>
        )}
        <p className="voice-note">Pour chaque morceau dont la mélodie est renseignée, le meilleur ton pour votre voix et la façon de le jouer avec un capodastre.{noMelody ? ` ${noMelody} morceau${noMelody > 1 ? 'x' : ''} sans étendue de mélodie : renseignez-la dans sa fiche.` : ''}</p>

        {cands.map(c => {
          const fit = fitMelody(range, c, c.key);
          const cap = bestCapo(fit.key, c.minor);
          const sh = fit.shift;
          const isOpen = open === c.id;
          return (
            <div key={c.id} className={'fit-card' + (isOpen ? ' open' : '')}>
              <button className="fit-top" onClick={() => setOpen(isOpen ? null : c.id)} aria-expanded={isOpen}>
                <div className="song-text">
                  <span className="song-title">{c.title}</span>
                  <span className="song-meta">Original en {KEY_FR[c.key]}{c.minor ? ' m' : ''} · mélodie {noteFr(c.low)} – {noteFr(c.high)}</span>
                </div>
                <span className="fit-key">{KEY_FR[fit.key]}{c.minor ? ' m' : ''}</span>
              </button>
              <RangeBar range={range} melody={fit} />
              <div className="fit-line">
                <span>{sh === 0 ? 'Ton d’origine' : `${sh > 0 ? '+' : '−'}${Math.abs(sh)} demi-ton${Math.abs(sh) > 1 ? 's' : ''} (${sh > 0 ? 'plus aigu' : 'plus grave'})`}</span>
                <span className="mono">{cap.capo ? `Capo ${cap.capo} · formes de ${cap.label}` : `Sans capo · ${cap.label}`}</span>
              </div>
              {fit.overflow > 0 && <span className="fit-warn">La mélodie dépasse votre tessiture de {fit.overflow} demi-ton{fit.overflow > 1 ? 's' : ''}.</span>}
              {isOpen && (
                <div className="fit-more">
                  <div className="fit-opts">
                    {capoOptions(fit.key, c.minor).filter(o => o.open).slice(0, 3).map(o => (
                      <span key={o.capo} className="tag">{o.capo ? `Capo ${o.capo}` : 'Sans capo'} · {o.label}</span>
                    ))}
                  </div>
                  <div className="grid-link-btns">
                    <button className="btn-outline" onClick={() => nav(`/outils/capo?key=${fit.key}&m=${c.minor ? 1 : 0}`)}>Capodastre ›</button>
                    {c.songId
                      ? <button className="btn-outline" onClick={() => apply(c, fit)}>{applied === c.id ? 'Appliqué ✓' : 'Appliquer sur scène'}</button>
                      : <button className="btn-outline" onClick={() => nav(`/voix/ex/${c.id}`)}>Chanter ›</button>}
                  </div>
                  {applied === c.id && <span className="voice-note">Sur scène : accords en formes de {cap.label}, capo {cap.capo}. Ça sonnera en {KEY_FR[fit.key]}{c.minor ? ' m' : ''}.</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <TabBar active={2} />
    </Phone>
  );
}
