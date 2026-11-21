import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { ChordDiagram } from '../components/ChordDiagram';
import { strum, type Playback } from '../lib/audio';
import {
  CHORD_TYPES, INV_NAMES, LETTERS, OPEN_MIDI, SHAPE_FR, capPos, chordSymbol, chordType, fingering, hasInversions, intervalOf, inversions,
  setsFor, slashName, voicingMidi, voicings, type Voicing,
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

export default function Accords() {
  const [root, setRoot] = useStoredState('chords.root', 9);
  const [typeId, setTypeId] = useStoredState('chords.type', 'maj');
  const [labels, setLabels] = useStoredState<'notes' | 'intervals' | 'fingers'>('chords.labels', 'notes');
  const [mode, setMode] = useStoredState<'positions' | 'inversions'>('chords.mode', 'positions');
  const [setPref, setSetPref] = useStoredState('chords.set', 0);
  // Opened from a grid chord: start on the position chosen there.
  const loc = useLocation();
  const [idx, setIdx] = useState(() => (loc.state as { pos?: number } | null)?.pos ?? 0);
  const type = chordType(typeId);
  const canInvert = hasInversions(type);
  const sets = setsFor(type);
  // The chosen string group if it fits this chord (3 or 4 strings), else the first that does.
  const set = sets.find(x => x.i === setPref)?.i ?? sets[0]?.i ?? 0;
  const showInv = mode === 'inversions' && canInvert;
  const list: Voicing[] = useMemo(() => (showInv ? inversions(root, type, set) : voicings(root, type)), [root, type, showInv, set]);
  const v = list[Math.min(idx, list.length - 1)];
  const player = useRef<Playback | null>(null);
  const neck = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  const firstChord = useRef(true);
  useEffect(() => { if (firstChord.current) { firstChord.current = false; return; } setIdx(0); }, [root, typeId, showInv, set]);
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
  const fingers = v ? fingering(v).fingers : [];
  /** What a voicing is: its CAGED shape, or its inversion. */
  const where = (x: Voicing) => (capPos(x) ? `case ${capPos(x)}` : 'position ouverte');
  const describe = (x: Voicing) => (x.inv !== undefined
    ? `${INV_NAMES[x.inv]} · ${slashName(root, type, x)}${x.inv ? ` · ${type.ivs[x.inv][1]} à la basse` : ''} · ${where(x)}`
    : `Forme de ${SHAPE_FR[x.shape!]} (${x.shape}) · ${where(x)}`);
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

        <div className="seg" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }} role="group" aria-label="Affichage">
          <button className={!showInv ? 'on' : ''} aria-pressed={!showInv} onClick={() => setMode('positions')}>Positions</button>
          <button className={showInv ? 'on' : ''} aria-pressed={showInv} disabled={!canInvert} onClick={() => setMode('inversions')}>Renversements</button>
        </div>
        <div className="seg label-seg" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }} role="group" aria-label="Sur le diagramme">
          <button className={labels === 'notes' ? 'on' : ''} aria-pressed={labels === 'notes'} onClick={() => setLabels('notes')}>Notes</button>
          <button className={labels === 'intervals' ? 'on' : ''} aria-pressed={labels === 'intervals'} onClick={() => setLabels('intervals')}>Intervalles</button>
          <button className={labels === 'fingers' ? 'on' : ''} aria-pressed={labels === 'fingers'} onClick={() => setLabels('fingers')}>Doigts</button>
        </div>
        {mode === 'inversions' && !canInvert && (
          <p className="inv-help">Les renversements se jouent avec les accords de 3 ou 4 notes : pas pour les power chords ni les neuvièmes.</p>
        )}
        {showInv && (
          <div className="hscroll" style={{ gap: 6 }} role="group" aria-label="Cordes">
            {sets.map(x => (
              <button key={x.i} className={'chip set-chip' + (x.i === set ? ' on-cream' : '')} aria-pressed={x.i === set} onClick={() => setSetPref(x.i)}>{x.label}</button>
            ))}
          </div>
        )}

        {v && (
          <div className="diagram-card" data-theme="dark">
            <div className="diagram-row">
              <button className="nav-pos" onClick={() => setIdx((idx - 1 + list.length) % list.length)} aria-label="Position précédente">‹</button>
              <div className="diagram-main">
                <ChordDiagram v={v} root={root} type={type} labels={labels} />
                <div className="string-notes" aria-label="Notes jouées, de la corde grave à l’aiguë">
                  {v.frets.map((f, s) => <span key={s} className={f === null ? 'mute' : mod12(OPEN_MIDI[s] + f - root) === 0 ? 'root' : ''}>{f === null ? '×' : labels === 'fingers' ? (f === 0 ? '○' : fingers[s]) : lbl(mod12(OPEN_MIDI[s] + f))}</span>)}
                </div>
              </div>
              <button className="nav-pos" onClick={() => setIdx((idx + 1) % list.length)} aria-label="Position suivante">›</button>
            </div>
            <span className="shape-label">{describe(v)} · {idx + 1}/{list.length}</span>
          </div>
        )}

        <span className="kicker" style={{ padding: '0 4px' }}>{showInv ? 'Renversements' : list.length === 5 ? 'Les 5 formes CAGED' : 'Positions'}</span>
        <div className="hscroll thumbs" data-theme="dark">
          {list.map((x, i) => (
            <button key={i} className={'thumb' + (i === idx ? ' on' : '')} onClick={() => setIdx(i)} aria-label={describe(x)}>
              <ChordDiagram v={x} root={root} type={type} size="small" />
              <span className="thumb-label">
                {x.inv !== undefined ? <b>{slashName(root, type, x)}</b> : <b>{x.shape}</b>} {capPos(x) ? `c.${capPos(x)}` : 'ouv.'}
              </span>
            </button>
          ))}
        </div>

        <span className="kicker" style={{ padding: '0 4px' }}>Sur le manche</span>
        <div className="neck-wrap" data-theme="dark">
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
