import { useEffect, useMemo, useRef } from 'react';
import { Phone, StatusBar, TabBar } from '../components/Chrome';
import { KEY_FR, KEY_ORDER, NOTE_L, SCALES, STR_PC, mod12 } from '../lib/music';
import { useStoredState } from '../lib/store';
import './Gammes.css';

const OPEN_W = 34, FRET_W = 46, LAST = 17;
const fretX = (f: number) => (f === 0 ? 0 : OPEN_W + (f - 1) * FRET_W);
const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'];

interface Cell { dot: boolean; label: string; root: boolean; blue: boolean; inBox: boolean }

/** Compute the fretboard: rows from high e (top) to low E (bottom). */
function buildNeck(key: number, maj: boolean, blue: boolean, showInt: boolean, boxN: number) {
  const sc = maj ? SCALES.maj : SCALES.min;
  const ivOf = (pc: number) => mod12(pc - key);
  // Fret of the root on the low E string, 0–11.
  const r0 = mod12(key - 4);

  // Position N: two scale notes per string starting from the N-th scale degree on low E.
  let box: Record<number, [number, number]> | null = null;
  if (boxN > 0) {
    const start = r0 + sc.iv[boxN - 1] - 1;
    let pts: [number, number][] = [];
    STR_PC.forEach((sp, si) => {
      let n = 0;
      for (let f = Math.max(0, start); f < start + 8 && n < 2; f++) {
        if (sc.iv.includes(ivOf(sp + f))) { pts.push([si, f]); n++; }
      }
    });
    // Fold a box that runs off the end of the neck down an octave.
    if (Math.max(...pts.map(p => p[1])) > LAST && Math.min(...pts.map(p => p[1])) >= 12) pts = pts.map(([s, f]) => [s, f - 12]);
    box = {};
    for (const [si, f] of pts) {
      const b = box[si] || (box[si] = [99, -1]);
      b[0] = Math.min(b[0], f); b[1] = Math.max(b[1], f);
    }
  }

  const rows = [5, 4, 3, 2, 1, 0].map(si => {
    const sp = STR_PC[si];
    const cells: Cell[] = [];
    for (let f = 0; f <= LAST; f++) {
      const iv = ivOf(sp + f);
      const isBlue = blue && iv === sc.blue;
      const dot = sc.iv.includes(iv) || isBlue;
      const inBox = !box || (!!box[si] && f >= box[si][0] && f <= box[si][1]);
      cells.push({
        dot, root: iv === 0, blue: isBlue, inBox,
        label: dot ? (showInt ? (isBlue ? sc.blueLab : sc.lab[iv]) : NOTE_L[mod12(sp + f)]) : '',
      });
    }
    return { si, label: STRING_LABELS[si], cells };
  });

  const boxStart = box ? Math.min(...Object.values(box).map(b => b[0])) : null;
  return { rows, boxStart };
}

export default function Gammes() {
  const [key, setKey] = useStoredState('scale.key', 9);
  const [maj, setMaj] = useStoredState('scale.maj', false);
  const [blue, setBlue] = useStoredState('scale.blue', false);
  const [showInt, setShowInt] = useStoredState('scale.int', false);
  const [boxN, setBoxN] = useStoredState('scale.box', 1);
  const neckRef = useRef<HTMLDivElement>(null);
  const firstScroll = useRef(true);

  const { rows, boxStart } = useMemo(() => buildNeck(key, maj, blue, showInt, boxN), [key, maj, blue, showInt, boxN]);

  // Bring the selected position into view.
  useEffect(() => {
    const el = neckRef.current;
    if (!el) return;
    const left = boxStart == null ? 0 : Math.max(0, fretX(boxStart) - 40);
    el.scrollTo({ left, behavior: firstScroll.current ? 'auto' : 'smooth' });
    firstScroll.current = false;
  }, [boxStart, key, maj]);

  const relPc = maj ? mod12(key + 9) : mod12(key + 3);
  const neckW = OPEN_W + LAST * FRET_W;

  return (
    <Phone label="06 Gammes">
      <StatusBar />
      <div className="screen-body" style={{ gap: 10 }}>
        <div className="head">
          <div className="head-titles">
            <span className="kicker">Pratiquer</span>
            <span className="display" style={{ fontSize: 30 }}>GAMMES</span>
          </div>
          <div className="mini-seg">
            <button className={!showInt ? 'on' : ''} onClick={() => setShowInt(false)}>Notes</button>
            <button className={showInt ? 'on' : ''} onClick={() => setShowInt(true)}>Intervalles</button>
          </div>
        </div>

        <div className="scale-types">
          <button className={'scale-type' + (!maj ? ' on' : '')} onClick={() => setMaj(false)}>Penta mineure</button>
          <button className={'scale-type' + (maj ? ' on' : '')} onClick={() => setMaj(true)}>Penta majeure</button>
          <button className={'blue-btn' + (blue ? ' on' : '')} onClick={() => setBlue(!blue)} aria-pressed={blue}>
            <span className="blue-led" />Note bleue
          </button>
        </div>

        <div className="hscroll" style={{ gap: 6 }}>
          {KEY_ORDER.map(pc => (
            <button key={pc} className={'chip key-chip' + (pc === key ? ' on-amber' : '')} onClick={() => setKey(pc)}>{KEY_FR[pc]}</button>
          ))}
        </div>

        <div className="scale-title">
          <span className="scale-title-main">{KEY_FR[key]}{maj ? ' penta majeure' : ' penta mineure'}</span>
          <span>· mêmes notes que {KEY_FR[relPc]}{maj ? ' penta mineure' : ' penta majeure'}</span>
        </div>

        <div className="neck-wrap">
          <div className="neck-strings">
            {rows.map(r => <span key={r.si}>{r.label}</span>)}
          </div>
          <div className="neck-scroll" ref={neckRef}>
            <div className="neck" style={{ width: neckW }}>
              {rows.map(r => (
                <div key={r.si} className="neck-row">
                  {r.cells.map((c, f) => (
                    <div key={f} className={'fret' + (f === 0 ? ' open' : '')} style={{ width: f === 0 ? OPEN_W : FRET_W }}>
                      <span className="wire" style={{ height: 1 + r.si * 0.32 }} />
                      {c.dot && (
                        <span
                          className={'dot' + (c.root ? ' root' : c.blue ? ' blue' : '')}
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
                    <span key={f} style={{ width: f === 0 ? OPEN_W : FRET_W, color: dbl ? 'var(--amber)' : mk ? 'var(--tan)' : '#6f665a' }}>
                      {f === 0 ? '' : dbl ? '●● 12' : mk ? `● ${f}` : f}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="boxes">
          {['Tout', '1', '2', '3', '4', '5'].map((l, i) => (
            <button key={l} className={'chip box-btn' + (i === boxN ? ' on-cream' : '')} onClick={() => setBoxN(i)}>{l}</button>
          ))}
        </div>
      </div>
      <TabBar active={2} />
    </Phone>
  );
}
