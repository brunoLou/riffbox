import { STYLES, type GenOptions, type GenStyle } from '../lib/generate';
import { KFR, MINOR_FR, OUT_PC, mod12 } from '../lib/music';
import { useStoredState } from '../lib/store';
import { useDialog } from '../lib/useDialog';
import './NewGridSheet.css';

type Choice = { style: GenStyle; key: number | 'random'; bars: 4 | 8; bridge: boolean };
const DEFAULT: Choice = { style: 'pop', key: 'random', bars: 4, bridge: true };

/** « Nouvelle grille » : an empty grid, or one generated from a style, a key and a structure. */
export function NewGridSheet({ onEmpty, onGenerate, onClose }: {
  onEmpty: () => void; onGenerate: (o: GenOptions) => void; onClose: () => void;
}) {
  // The last choices are remembered for next time.
  const [c, setC] = useStoredState<Choice>('grid.genChoice', DEFAULT);
  const dlg = useDialog(onClose);
  const set = (p: Partial<Choice>) => setC({ ...c, ...p });
  const go = () => onGenerate({
    style: c.style, bars: c.bars, bridge: c.bridge,
    key: c.key === 'random' ? OUT_PC[Math.floor(Math.random() * 12)] : c.key,
  });

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="set-sheet newgrid-sheet" ref={dlg} role="dialog" aria-label="Nouvelle grille" onClick={e => e.stopPropagation()}>
        <div className="set-sheet-head">
          <span className="kicker sheet-kicker">Nouvelle grille</span>
          <button className="player-close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <div className="sheet-field">
          <span id="ng-style">Style</span>
          <div className="ng-chips" role="group" aria-labelledby="ng-style">
            {STYLES.map(s => (
              <button key={s.id} className={'ng-chip' + (c.style === s.id ? ' on' : '')} aria-pressed={c.style === s.id} onClick={() => set({ style: s.id })}>{s.label}</button>
            ))}
          </div>
        </div>

        <label className="sheet-field">
          <span>Tonalité</span>
          <select className="text-input" value={String(c.key)} onChange={e => set({ key: e.target.value === 'random' ? 'random' : Number(e.target.value) })}>
            <option value="random">Au hasard</option>
            {OUT_PC.map(pc => <option key={pc} value={pc}>{KFR[pc]} (relatif {MINOR_FR[mod12(pc + 9)]} m)</option>)}
          </select>
        </label>

        <div className="sheet-field row">
          <span>Mesures par section</span>
          <div className="seg ng-seg" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
            {([4, 8] as const).map(n => <button key={n} className={c.bars === n ? 'on' : ''} aria-pressed={c.bars === n} onClick={() => set({ bars: n })}>{n}</button>)}
          </div>
        </div>
        <label className="sheet-field row ng-check">
          <span>Avec un pont</span>
          <input type="checkbox" checked={c.bridge} onChange={e => set({ bridge: e.target.checked })} />
        </label>

        <button className="btn-primary" onClick={go}>Générer la grille</button>
        <button className="btn-outline" onClick={onEmpty}>Grille vide</button>
      </div>
    </div>
  );
}
