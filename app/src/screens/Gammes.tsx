import { useEffect, useMemo, useRef } from 'react';
import { Phone, StatusBar, TabBar } from '../components/Chrome';
import { playLick, type Playback } from '../lib/audio';
import { KEY_FR, KEY_ORDER, NOTE_L, STR_PC, mod12 } from '../lib/music';
import { SCALE_DEFS, ivLabel, listenNotes, positions, relatedLine, scaleDef, slideForms, type Box, type ScaleDef } from '../lib/scales';
import { readStored, useStoredState } from '../lib/store';
import { LibTabs } from './Accords';
import './Gammes.css';
import { useFretWidth } from '../lib/useFretWidth';
import { useMarkUsed } from '../lib/usage';

const OPEN_W = 34, MIN_FRET_W = 46, LAST = 17;
const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'];

interface Cell { dot: boolean; label: string; root: boolean; blue: boolean; inBox: boolean }
/** The three treble strings (G, B, high e); with « 3 cordes aiguës » the others are dimmed. */
const isTreble = (si: number) => si >= 3;

/** The fretboard, rows from high e (top) to low E (bottom); notes outside the position are dimmed. */
function buildNeck(def: ScaleDef, key: number, blue: boolean, showInt: boolean, box: Box | null, treble: boolean) {
  const rows = [5, 4, 3, 2, 1, 0].map(si => {
    const sp = STR_PC[si];
    const cells: Cell[] = [];
    for (let f = 0; f <= LAST; f++) {
      const iv = mod12(sp + f - key);
      const isBlue = (blue && def.blue?.iv === iv) || (def.id === 'blues' && iv === 6);
      const dot = def.iv.includes(iv) || isBlue;
      const inBox = (!treble || isTreble(si)) && (!box || (!!box[si] && f >= box[si][0] && f <= box[si][1]));
      cells.push({
        dot, root: iv === 0, blue: isBlue, inBox,
        label: dot ? (showInt ? (isBlue && def.blue ? def.blue.lab : ivLabel(def, iv)) : NOTE_L[mod12(sp + f)]) : '',
      });
    }
    return { si, label: STRING_LABELS[si], cells, dim: treble && !isTreble(si) };
  });
  return rows;
}

export default function Gammes() {
  useMarkUsed('manche'); // a reference tool: opening it is using it
  // First launch after the update: keep the pentatonic chosen before.
  const [scaleId, setScaleId] = useStoredState('scale.id', readStored('scale.maj', false) ? 'pmaj' : 'pmin');
  const [key, setKey] = useStoredState('scale.key', 9);
  const [blue, setBlue] = useStoredState('scale.blue', false);
  const [showInt, setShowInt] = useStoredState('scale.int', false);
  const [boxN, setBoxN] = useStoredState('scale.box', 1);
  const [treble, setTreble] = useStoredState('scale.treble', false);
  /** Sliding form chosen (1–5), 0: none (the positions above apply). */
  const [slideN, setSlideN] = useStoredState('scale.slide', 0);
  const neckRef = useRef<HTMLDivElement>(null);
  // On a phone the neck scrolls; on a tablet the frets widen to show it whole.
  const FRET_W = useFretWidth(neckRef, OPEN_W, LAST, MIN_FRET_W);
  const fretX = (f: number) => (f === 0 ? 0 : OPEN_W + (f - 1) * FRET_W);
  const firstScroll = useRef(true);
  const player = useRef<Playback | null>(null);

  const def = scaleDef(scaleId);
  const pos = useMemo(() => positions(def, key), [def, key]);
  const slides = useMemo(() => (treble ? slideForms(def, key) : []), [def, key, treble]);
  const slide = slideN > 0 ? slides[Math.min(slideN, slides.length) - 1] ?? null : null;
  const sel = slide ?? (boxN > 0 ? pos[Math.min(boxN, pos.length) - 1] : null);
  const rows = useMemo(() => buildNeck(def, key, blue, showInt, sel?.box ?? null, treble), [def, key, blue, showInt, sel, treble]);
  const boxStart = sel ? Math.min(...Object.values(sel.box).map(b => b[0])) : null;

  // Bring the selected position into view.
  useEffect(() => {
    const el = neckRef.current;
    if (!el) return;
    const left = boxStart == null ? 0 : Math.max(0, fretX(boxStart) - 40);
    el.scrollTo({ left, behavior: firstScroll.current ? 'auto' : 'smooth' });
    firstScroll.current = false;
  }, [boxStart, key, scaleId]);
  useEffect(() => () => player.current?.stop(), []);

  const listen = () => {
    player.current?.stop();
    // A sliding form plays its six notes up and back down.
    const notes = slide ? [...slide.notes, ...slide.notes.slice(0, -1).reverse()] : listenNotes(def, key, blue);
    player.current = playLick(notes, 132, () => { player.current = null; });
  };

  return (
    <Phone label="06 Gammes" wide>
      <StatusBar />
      <div className="screen-body neck-screen" style={{ gap: 10 }}>
        <div className="head">
          <div className="head-titles">
            <span className="kicker">Pratiquer</span>
            <h1 className="display" style={{ fontSize: 30 }}>GAMMES</h1>
          </div>
          <div className="mini-seg">
            <button className={!showInt ? 'on' : ''} onClick={() => setShowInt(false)}>Notes</button>
            <button className={showInt ? 'on' : ''} onClick={() => setShowInt(true)}>Intervalles</button>
          </div>
        </div>

        <LibTabs active={0} />

        <div className="hscroll scale-chips" role="group" aria-label="Gamme">
          {SCALE_DEFS.map((d, i) => (
            <button key={d.id} className={'chip scale-chip' + (d.id === scaleId ? ' on-cream' : '') + (i > 0 && SCALE_DEFS[i - 1].group !== d.group ? ' sep' : '')}
              onClick={() => { setScaleId(d.id); setBoxN(1); setSlideN(0); }} aria-pressed={d.id === scaleId}>{d.chip}</button>
          ))}
        </div>

        <div className="hscroll" style={{ gap: 6 }} role="group" aria-label="Tonalité">
          {KEY_ORDER.map(pc => (
            <button key={pc} className={'chip key-chip' + (pc === key ? ' on-amber' : '')} onClick={() => setKey(pc)}>{KEY_FR[pc]}</button>
          ))}
        </div>

        <div className="scale-head">
          <div className="scale-title">
            <span className="scale-title-main">{KEY_FR[key]} {def.fr}</span>
            <span>· {relatedLine(def, key)}</span>
          </div>
          {def.blue && (
            <button className={'blue-btn small' + (blue ? ' on' : '')} onClick={() => setBlue(!blue)} aria-pressed={blue}>
              <span className="blue-led" />Note bleue
            </button>
          )}
          <button className={'blue-btn small treble-btn' + (treble ? ' on' : '')} onClick={() => { setTreble(!treble); setSlideN(0); }} aria-pressed={treble}
            title="Ne montrer que les notes des cordes Sol, Si et Mi aigu">
            <span className="blue-led" />3 cordes aiguës
          </button>
          <button className="scale-listen" onClick={listen} aria-label="Écouter la gamme">▶</button>
        </div>

        <div className="neck-wrap" data-theme="dark">
          <div className="neck-strings">
            {rows.map(r => <span key={r.si} className={r.dim ? 'dim' : undefined}>{r.label}</span>)}
          </div>
          <div className="neck-scroll" ref={neckRef} tabIndex={0} role="region" aria-label="Manche : notes de la gamme, faire défiler avec les flèches">
            <div className="neck" style={{ width: OPEN_W + LAST * FRET_W }}>
              {rows.map(r => (
                <div key={r.si} className={'neck-row' + (r.dim ? ' dim' : '')} data-string={r.si}>
                  {r.cells.map((c, f) => (
                    <div key={f} className={'fret' + (f === 0 ? ' open' : '')} style={{ width: f === 0 ? OPEN_W : FRET_W }}>
                      <span className="wire" style={{ height: 1 + r.si * 0.32 }} />
                      {c.dot && (
                        <span
                          className={'dot' + (c.root ? ' root' : c.blue ? ' blue' : '') + (c.inBox ? ' lit' : '')}
                          style={{ opacity: c.inBox ? 1 : 0.16, boxShadow: c.root && c.inBox ? '0 0 10px rgba(233,162,59,.6)' : 'none' }}
                        >{c.label}</span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
              <div className="fret-nums">
                {Array.from({ length: LAST + 1 }, (_, f) => {
                  const mk = [3, 5, 7, 9, 15, 17].includes(f), dbl = f === 12;
                  return (
                    <span key={f} style={{ width: f === 0 ? OPEN_W : FRET_W, color: dbl ? 'var(--amber)' : mk ? 'var(--tan)' : 'var(--faint)' }}>
                      {f === 0 ? '' : dbl ? '●● 12' : mk ? `● ${f}` : f}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="pos-head">
          <span className="kicker">{def.group === 'penta' ? 'Positions' : 'Positions CAGED'}</span>
          {sel?.shape && <span className="pos-shape">forme de l’accord en {sel.shape}</span>}
        </div>
        <div className="boxes" style={{ gridTemplateColumns: `auto repeat(${pos.length},minmax(0,1fr))` }}>
          {['Tout', ...pos.map(p => p.label)].map((l, i) => (
            <button key={l + i} className={'chip box-btn' + (!slide && i === Math.min(boxN, pos.length) ? ' on-cream' : '')}
              onClick={() => { setBoxN(i); setSlideN(0); }}>{l}</button>
          ))}
        </div>

        {slides.length > 0 && (
          <>
            <div className="pos-head">
              <span className="kicker">Formes glissées</span>
              <span className="pos-shape">2 notes par corde, la main glisse le long du manche</span>
            </div>
            <div className="boxes" role="group" aria-label="Formes glissées" style={{ gridTemplateColumns: `repeat(${slides.length},minmax(0,1fr))` }}>
              {slides.map((f, i) => (
                <button key={f.label} className={'chip box-btn' + (slideN === i + 1 ? ' on-cream' : '')} aria-pressed={slideN === i + 1}
                  aria-label={`Forme glissée ${i + 1}, case ${f.box[3][0]} à ${f.box[5][1]}`}
                  onClick={() => setSlideN(slideN === i + 1 ? 0 : i + 1)}>{f.label}</button>
              ))}
            </div>
          </>
        )}
      </div>
      <TabBar active={2} />
    </Phone>
  );
}
