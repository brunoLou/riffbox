import { NOTE_L, mod12 } from '../lib/music';
import { OPEN_MIDI, intervalOf, type ChordType, type Voicing } from '../lib/chords';
import './ChordDiagram.css';

const FRETS = 5;

/** Classic vertical chord box: strings low E (left) to high e, frets top to bottom. */
export function ChordDiagram({ v, root, type, labels, size = 'big' }: {
  v: Voicing; root: number; type: ChordType; labels?: 'notes' | 'intervals'; size?: 'big' | 'small';
}) {
  const big = size === 'big';
  const W = big ? 200 : 76, H = big ? 236 : 92;
  const padX = big ? 30 : 10, top = big ? 34 : 14, bottom = big ? 14 : 6;
  const sx = (s: number) => padX + (s * (W - 2 * padX)) / 5;
  const fh = (H - top - bottom) / FRETS;
  const fy = (f: number) => top + (f - v.base + 0.5) * fh;
  const r = big ? 13 : 5;

  // Barre: the lowest fretted fret, held across three or more strings with nothing lower in between.
  const fretted = v.frets.map((f, s) => ({ f, s })).filter((x): x is { f: number; s: number } => x.f !== null && x.f > 0);
  const minF = fretted.length ? Math.min(...fretted.map(x => x.f)) : 0;
  const atMin = fretted.filter(x => x.f === minF).map(x => x.s);
  const barre = atMin.length >= 3 && v.frets.slice(atMin[0], atMin[atMin.length - 1] + 1).every(f => f !== null && f >= minF)
    ? { from: atMin[0], to: atMin[atMin.length - 1] } : null;

  const label = (s: number, f: number) => {
    const pc = mod12(OPEN_MIDI[s] + f);
    return labels === 'intervals' ? intervalOf(root, type, pc) ?? '' : NOTE_L[pc];
  };
  const isRoot = (s: number, f: number) => mod12(OPEN_MIDI[s] + f - root) === 0;

  return (
    <svg className={'chord-svg ' + size} viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden>
      {/* frets */}
      {Array.from({ length: FRETS + 1 }, (_, i) => (
        <line key={i} x1={sx(0)} x2={sx(5)} y1={top + i * fh} y2={top + i * fh} className={i === 0 && v.base === 1 ? 'cd-nut' : 'cd-fret'} />
      ))}
      {/* strings */}
      {[0, 1, 2, 3, 4, 5].map(s => <line key={s} x1={sx(s)} x2={sx(s)} y1={top} y2={H - bottom} className="cd-string" style={{ strokeWidth: big ? 1 + (5 - s) * 0.3 : 1 }} />)}
      {big && v.base > 1 && <text x={padX - 10} y={top + fh * 0.5 + 4} className="cd-pos" textAnchor="end">{v.base}</text>}
      {/* open / muted markers */}
      {v.frets.map((f, s) => (f === null
        ? <text key={s} x={sx(s)} y={top - (big ? 10 : 4)} className={'cd-mute ' + size} textAnchor="middle">×</text>
        : f === 0 ? <circle key={s} cx={sx(s)} cy={top - (big ? 15 : 6)} r={big ? 6 : 2.5} className={'cd-open' + (isRoot(s, 0) ? ' root' : '')} /> : null))}
      {barre && <rect x={sx(barre.from) - r} y={fy(minF) - r} width={sx(barre.to) - sx(barre.from) + 2 * r} height={2 * r} rx={r} className="cd-barre" />}
      {fretted.map(({ f, s }) => (
        <g key={s}>
          <circle cx={sx(s)} cy={fy(f)} r={r} className={'cd-dot' + (isRoot(s, f) ? ' root' : '')} />
          {big && labels && <text x={sx(s)} y={fy(f) + 4} className="cd-label" textAnchor="middle">{label(s, f)}</text>}
        </g>
      ))}
    </svg>
  );
}
