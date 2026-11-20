import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { ChordDiagram } from '../components/ChordDiagram';
import { strum, type Playback } from '../lib/audio';
import {
  CHORD_TYPES, LETTERS, OPEN_MIDI, SHAPE_FR, chordSymbol, chordType, intervalOf, voicingMidi, voicings, type Voicing,
} from '../lib/chords';
import { KEY_FR, KEY_ORDER, NOTE_L, mod12 } from '../lib/music';
import { useStoredState } from '../lib/store';
import './Accords.css';

/** "Gammes | Accords" switch shared by the two libraries. */
export function LibTabs({ active }: { active: 0 | 1 }) {
  return (
    <div className="seg lib-tabs" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
      <Link to="/pratiquer/gammes" replace className={active === 0 ? 'on' : ''}>Gammes</Link>
      <Link to="/pratiquer/accords" replace className={active === 1 ? 'on' : ''}>Accords</Link>
    </div>
  );
}

const TYPE_LABEL: Record<string, string> = { maj: 'Majeur', m: 'Mineur' };
const OPEN_W = 30, FRET_W = 40, LAST = 15;
const fretX = (f: number) => (f === 0 ? 0 : OPEN_W + (f - 1) * FRET_W);
const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'];
/** Position of a voicing: 0 when it uses open strings, else its lowest fret. */
const capPos = (v: Voicing) => {
  if (v.frets.includes(0)) return 0;
  const fr = v.frets.filter((f): f is number => f !== null && f > 0);
  return fr.length ? Math.min(...fr) : 0;
};

export default function Accords() {
  const [root, setRoot] = useStoredState('chords.root', 9);
  const [typeId, setTypeId] = useStoredState('chords.type', 'maj');
  const [labels, setLabels] = useStoredState<'notes' | 'intervals'>('chords.labels', 'notes');
  const [idx, setIdx] = useState(0);
  const type = chordType(typeId);
  const list = useMemo(() => voicings(root, type), [root, type]);
  const v = list[Math.min(idx, list.length - 1)];
  const player = useRef<Playback | null>(null);
  const neck = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useEffect(() => { setIdx(0); }, [root, typeId]);
  useEffect(() => () => player.current?.stop(), []);
  // Keep the selected position in view on the neck.
  useEffect(() => {
    const el = neck.current;
    if (!el || !v) return;
    el.scrollTo({ left: Math.max(0, fretX(Math.max(0, capPos(v) - 1)) - 20), behavior: first.current ? 'auto' : 'smooth' });
    first.current = false;
  }, [v]);

  const listen = () => { player.current?.stop(); if (v) player.current = strum(voicingMidi(v)); };
  const lbl = (pc: number) => (labels === 'intervals' ? intervalOf(root, type, pc) ?? '' : NOTE_L[pc]);
  const sym = chordSymbol(root, type);

  return (
    <Phone label="06b Accords">
      <StatusBar />
      <div className="chords-scroll">
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/pratiquer" />
            <div className="head-titles">
              <span className="kicker">Pratiquer</span>
              <span className="display" style={{ fontSize: 30 }}>ACCORDS</span>
            </div>
          </div>
          <div className="mini-seg">
            <button className={labels === 'notes' ? 'on' : ''} onClick={() => setLabels('notes')}>Notes</button>
            <button className={labels === 'intervals' ? 'on' : ''} onClick={() => setLabels('intervals')}>Intervalles</button>
          </div>
        </div>
        <LibTabs active={1} />

        <div className="hscroll" style={{ gap: 6 }} role="group" aria-label="Fondamentale">
          {KEY_ORDER.map(pc => (
            <button key={pc} className={'chip key-chip' + (pc === root ? ' on-amber' : '')} onClick={() => setRoot(pc)} aria-pressed={pc === root}>{KEY_FR[pc]}</button>
          ))}
        </div>
        <div className="hscroll" style={{ gap: 6 }} role="group" aria-label="Type d’accord">
          {CHORD_TYPES.map(t => (
            <button key={t.id} className={'chip type-chip' + (TYPE_LABEL[t.id] ? ' word' : '') + (t.id === typeId ? ' on-cream' : '')} onClick={() => setTypeId(t.id)} aria-pressed={t.id === typeId}>
              {TYPE_LABEL[t.id] ?? t.sym}
            </button>
          ))}
        </div>

        <div className="chord-card">
          <div className="chord-id">
            <span className="chord-sym">{sym}</span>
            <span className="chord-fr">{KEY_FR[root]} {type.fr}</span>
            <div className="chord-formula">
              {type.ivs.map(([s, l]) => (
                <span key={s} className={s === 0 ? 'root' : ''}><b>{l}</b>{LETTERS[mod12(root + s)]}</span>
              ))}
            </div>
          </div>
          <button className="listen" onClick={listen} aria-label={`Écouter ${sym}`}>▶</button>
        </div>

        {v && (
          <div className="diagram-card">
            <div className="diagram-row">
              <button className="nav-pos" onClick={() => setIdx((idx - 1 + list.length) % list.length)} aria-label="Position précédente">‹</button>
              <div className="diagram-main">
                <ChordDiagram v={v} root={root} type={type} labels={labels} />
                <div className="string-notes" aria-label="Notes jouées, de la corde grave à l’aiguë">
                  {v.frets.map((f, s) => <span key={s} className={f === null ? 'mute' : mod12(OPEN_MIDI[s] + f - root) === 0 ? 'root' : ''}>{f === null ? '×' : lbl(mod12(OPEN_MIDI[s] + f))}</span>)}
                </div>
              </div>
              <button className="nav-pos" onClick={() => setIdx((idx + 1) % list.length)} aria-label="Position suivante">›</button>
            </div>
            <span className="shape-label">Forme de {SHAPE_FR[v.shape]} ({v.shape}) · {capPos(v) ? `case ${capPos(v)}` : 'position ouverte'} · {idx + 1}/{list.length}</span>
          </div>
        )}

        <span className="kicker" style={{ padding: '0 4px' }}>{list.length === 5 ? 'Les 5 formes CAGED' : 'Positions'}</span>
        <div className="hscroll thumbs">
          {list.map((x, i) => (
            <button key={i} className={'thumb' + (i === idx ? ' on' : '')} onClick={() => setIdx(i)} aria-label={`Forme de ${SHAPE_FR[x.shape]}, ${capPos(x) ? 'case ' + capPos(x) : 'position ouverte'}`}>
              <ChordDiagram v={x} root={root} type={type} size="small" />
              <span className="thumb-label"><b>{x.shape}</b> {capPos(x) ? `c.${capPos(x)}` : 'ouv.'}</span>
            </button>
          ))}
        </div>

        <span className="kicker" style={{ padding: '0 4px' }}>Sur le manche</span>
        <div className="neck-wrap">
          <div className="neck-strings">
            {[5, 4, 3, 2, 1, 0].map(s => <span key={s}>{STRING_LABELS[s]}</span>)}
          </div>
          <div className="neck-scroll" ref={neck}>
            <div className="neck" style={{ width: OPEN_W + LAST * FRET_W }}>
              {[5, 4, 3, 2, 1, 0].map(s => (
                <div key={s} className="neck-row">
                  {Array.from({ length: LAST + 1 }, (_, f) => {
                    const pc = mod12(OPEN_MIDI[s] + f);
                    const tone = intervalOf(root, type, pc) !== null;
                    const played = v?.frets[s] === f;
                    return (
                      <div key={f} className={'fret' + (f === 0 ? ' open' : '')} style={{ width: f === 0 ? OPEN_W : FRET_W }}>
                        <span className="wire" style={{ height: 1 + s * 0.32 }} />
                        {tone && (
                          <span className={'dot' + (pc === mod12(root) ? ' root' : '')} style={{ opacity: played ? 1 : 0.16, boxShadow: played ? '0 0 8px rgba(233,162,59,.5)' : 'none' }}>
                            {lbl(pc)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              <div className="fret-nums">
                {Array.from({ length: LAST + 1 }, (_, f) => {
                  const mk = [3, 5, 7, 9, 15].includes(f), dbl = f === 12;
                  return <span key={f} style={{ width: f === 0 ? OPEN_W : FRET_W, color: dbl ? 'var(--amber)' : mk ? 'var(--tan)' : '#6f665a' }}>{f === 0 ? '' : dbl ? '●● 12' : mk ? `● ${f}` : f}</span>;
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      <TabBar active={2} />
    </Phone>
  );
}
