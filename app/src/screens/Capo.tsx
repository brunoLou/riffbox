import { useSearchParams } from 'react-router-dom';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { bestCapo, capoOptions } from '../lib/capo';
import { KEY_FR, KEY_ORDER, mod12 } from '../lib/music';
import './Voix.css';
import { useMarkUsed } from '../lib/usage';

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
/** I–IV–V (or i–iv–v) chords of the shapes key, as played on the guitar. */
const shapeChords = (k: number, minor: boolean) =>
  minor ? [NAMES[k] + 'm', NAMES[mod12(k + 5)] + 'm', NAMES[mod12(k + 7)] + '7'] : [NAMES[k], NAMES[mod12(k + 5)], NAMES[mod12(k + 7)]];

/** Capo calculator: which shapes and fret give the key that must sound. */
export default function Capo() {
  useMarkUsed('capo'); // a reference tool: opening it is using it
  const [params, setParams] = useSearchParams();
  const key = mod12(Number(params.get('key') ?? 7));
  const minor = params.get('m') === '1';
  const set = (k: number, m: boolean) => setParams({ key: String(k), m: m ? '1' : '0' }, { replace: true });
  const best = bestCapo(key, minor);

  return (
    <Phone label="11 Capodastre">
      <StatusBar />
      <div className="voice-scroll">
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/voix" />
            <div className="head-titles">
              <span className="kicker">Outils</span>
              <h1 className="display" style={{ fontSize: 28 }}>CAPODASTRE</h1>
            </div>
          </div>
        </div>
        <span className="kicker" style={{ padding: '0 4px' }}>Ton qui doit sonner</span>
        <div className="hscroll" style={{ gap: 6 }}>
          {KEY_ORDER.map(k => (
            <button key={k} className={'chip key-chip' + (k === key ? ' on-amber' : '')} onClick={() => set(k, minor)}>{KEY_FR[k]}</button>
          ))}
        </div>
        <div className="seg" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
          <button className={!minor ? 'on' : ''} onClick={() => set(key, false)}>Majeur</button>
          <button className={minor ? 'on' : ''} onClick={() => set(key, true)}>Mineur</button>
        </div>

        <div className="capo-best">
          <span className="kicker" style={{ color: 'var(--accent-text)' }}>Le plus simple</span>
          <b className="display">{best.capo ? `CAPO ${best.capo}` : 'SANS CAPO'}</b>
          <span>Jouez en formes de <b>{best.label}</b> : {shapeChords(best.shapes, minor).join(' · ')}</span>
        </div>

        <div className="capo-list">
          {capoOptions(key, minor).map(o => (
            <div key={o.capo} className={'capo-row' + (o.capo === best.capo ? ' best' : '')}>
              <span className="capo-fret mono">{o.capo ? `Capo ${o.capo}` : 'Sans'}</span>
              <span className="capo-shape">formes de <b>{o.label}</b></span>
              <span className="capo-chords mono">{shapeChords(o.shapes, minor).join(' ')}</span>
              {o.open && <span className="capo-open">ouverts</span>}
            </div>
          ))}
        </div>
      </div>
      <TabBar active={2} />
    </Phone>
  );
}
