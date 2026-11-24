import { NOTE_L, mod12 } from '../lib/music';
import { isBlack } from '../lib/piano';
import './PianoKeys.css';

/**
 * A piano keyboard from `from` to `to` (MIDI, from a C to a B). Lit keys show their note; the
 * chord's root is amber. With `onKey`, keys can be touched (finding a chord, hearing a note).
 */
export function PianoKeys({ from, to, lit, rootPc, onKey, compact, label, names }: {
  from: number; to: number; lit: number[]; rootPc?: number | null;
  /** How to write each pitch class (spelt as in the chord); else sharps and flats as on the neck. */
  names?: Record<number, string>;
  onKey?: (midi: number) => void; compact?: boolean; label: string;
}) {
  const whites: number[] = [], blacks: number[] = [];
  for (let m = from; m <= to; m++) (isBlack(m) ? blacks : whites).push(m);
  const W = 20, H = compact ? 58 : 88, BW = 12, BH = H * 0.6;
  const xOf = (m: number) => whites.indexOf(m) * W;
  const blackX = (m: number) => xOf(m - 1) + W - BW / 2;
  const on = new Set(lit);
  const kind = (m: number) => (on.has(m) ? (rootPc != null && mod12(m) === rootPc ? ' root' : ' lit') : '');
  const key = (m: number, x: number, w: number, h: number, black: boolean) => {
    const props = onKey
      ? { role: 'button', tabIndex: 0, 'aria-pressed': on.has(m), 'aria-label': `${NOTE_L[mod12(m)]}${Math.floor(m / 12) - 1}`,
          onClick: () => onKey(m), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onKey(m); } } }
      : {};
    return (
      <g key={m} className={(black ? 'pk-black' : 'pk-white') + kind(m)} data-midi={m} {...props}>
        <rect x={x} y={0} width={w} height={h} rx={black ? 2 : 3} />
        {on.has(m) && <circle cx={x + w / 2} cy={h - (black ? 8 : 11)} r={black ? 5.5 : 7.5} className="pk-dot" />}
        {on.has(m) && <text x={x + w / 2} y={h - (black ? 8 : 11) + 3} textAnchor="middle" className="pk-txt">{names?.[mod12(m)] ?? NOTE_L[mod12(m)].replace('♯', '#').replace('♭', 'b')}</text>}
        {!black && mod12(m) === 0 && !on.has(m) && <text x={x + w / 2} y={h - 6} textAnchor="middle" className="pk-c">C{Math.floor(m / 12) - 1}</text>}
      </g>
    );
  };
  return (
    <svg className={'piano-keys' + (compact ? ' compact' : '') + (onKey ? ' playable' : '')} viewBox={`0 0 ${whites.length * W} ${H}`}
      role={onKey ? 'group' : 'img'} aria-label={label} preserveAspectRatio="xMidYMid meet">
      {whites.map(m => key(m, xOf(m), W, H, false))}
      {blacks.map(m => key(m, blackX(m), BW, BH, true))}
    </svg>
  );
}
