import { useEffect, useRef, useState } from 'react';
import { playSteps, type Playback } from '../lib/audio';
import { MAX_FRET, STRING_FR, STRING_NAMES, addCols, emptyTab, setCell, tabNotes, tabToText, trimTab, type Tab, type TabCell } from '../lib/tab';
import { useDialog } from '../lib/useDialog';
import './TabEditor.css';

/** The tab of an idea, as text (high e on top), with a button to hear it. */
export function TabView({ tab, bpm }: { tab: Tab; bpm?: number }) {
  const [playing, setPlaying] = useState<number | null>(null);
  const player = useRef<Playback | null>(null);
  useEffect(() => () => player.current?.stop(), []);
  const toggle = () => {
    if (player.current) { player.current.stop(); player.current = null; setPlaying(null); return; }
    player.current = playSteps(tabNotes(tab), bpm ?? 90, () => { player.current = null; setPlaying(null); }, setPlaying);
  };
  return (
    <div className="tab-view">
      <pre className="tab-text" aria-label="Tablature">{tabToText(tab)}</pre>
      <button className="tab-play" onClick={toggle} aria-label={playing !== null ? 'Arrêter la tablature' : 'Écouter la tablature'}>{playing !== null ? '❚❚ Tab' : '▶ Tab'}</button>
    </div>
  );
}

const PAD: (number | 'x' | 'del')[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 'x', 'del'];

/**
 * Writing a riff in tab on a phone: a grid of six strings by steps (eighth notes). Touch a cell,
 * then a fret on the pad: the cursor moves on to the next step.
 */
export function TabEditor({ tab, bpm, title, onSave, onClose }: {
  tab?: Tab; bpm?: number; title: string; onSave: (t: Tab) => void; onClose: () => void;
}) {
  const [t, setT] = useState<Tab>(() => (tab ? addCols(tab, Math.max(0, 16 - tab.cols.length)) : emptyTab(16)));
  const [cur, setCur] = useState({ col: 0, s: 0 });
  const [high, setHigh] = useState(false);
  const [playingCol, setPlayingCol] = useState<number | null>(null);
  const player = useRef<Playback | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const dlg = useDialog(onClose);
  useEffect(() => () => player.current?.stop(), []);
  // Keep the cursor in view.
  useEffect(() => { grid.current?.querySelector<HTMLElement>(`[data-col="${cur.col}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [cur.col]);

  const put = (v: TabCell) => {
    let next = setCell(t, cur.col, cur.s, v);
    if (v !== null && cur.col === next.cols.length - 1) next = addCols(next, 8);
    setT(next);
    if (v !== null) setCur({ col: Math.min(cur.col + 1, next.cols.length - 1), s: cur.s });
  };
  const pad = (k: number | 'x' | 'del') => (k === 'del' ? put(null) : k === 'x' ? put(-1) : put(high ? k + 12 : k));
  const listen = () => {
    if (player.current) { player.current.stop(); player.current = null; setPlayingCol(null); return; }
    player.current = playSteps(tabNotes(t), bpm ?? 90, () => { player.current = null; setPlayingCol(null); }, setPlayingCol);
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="set-sheet tab-sheet" ref={dlg} role="dialog" aria-label={`Tablature : ${title}`} onClick={e => e.stopPropagation()}>
        <div className="set-sheet-head">
          <span className="kicker sheet-kicker">Tablature · {title}</span>
          <button className="player-close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <div className="tab-grid" ref={grid} role="grid" aria-label="Tablature : cordes et temps">
          {[5, 4, 3, 2, 1, 0].map(s => (
            <div key={s} className="tab-row" role="row">
              <span className="tab-string" role="rowheader">{STRING_NAMES[s]}</span>
              {t.cols.map((c, i) => {
                const v = c[s];
                const on = cur.col === i && cur.s === s;
                return (
                  <button key={i} role="gridcell" data-col={i} aria-selected={on}
                    className={'tab-cell' + (on ? ' cur' : '') + (i % 4 === 0 ? ' beat' : '') + (playingCol === i ? ' play' : '')}
                    aria-label={`${STRING_FR[s]}, temps ${i + 1} : ${v === null ? 'vide' : v === -1 ? 'étouffée' : `case ${v}`}`}
                    onClick={() => setCur({ col: i, s })}>{v === null ? '' : v === -1 ? '×' : v}</button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="tab-pad" role="group" aria-label={`Case sur la corde ${STRING_FR[cur.s]}, temps ${cur.col + 1}`}>
          {PAD.map(k => (
            <button key={String(k)} className={'tab-key' + (k === 'del' ? ' del' : '')} onClick={() => pad(k)}
              aria-label={k === 'del' ? 'Effacer la case' : k === 'x' ? 'Note étouffée' : `Case ${high ? (k as number) + 12 : k}`}>
              {k === 'del' ? '⌫' : k === 'x' ? '×' : high ? (k as number) + 12 > MAX_FRET ? '' : (k as number) + 12 : k}
            </button>
          ))}
          <button className={'tab-key' + (high ? ' on' : '')} aria-pressed={high} onClick={() => setHigh(!high)}>{high ? '0–12' : '+12'}</button>
        </div>
        <div className="tab-bar">
          <button className="btn-outline" onClick={listen}>{playingCol !== null ? 'Arrêter' : '▶ Écouter'}</button>
          <button className="btn-outline" onClick={() => setT(addCols(t, 8))}>+ 8 temps</button>
        </div>
        <button className="btn-primary" onClick={() => onSave(trimTab(t))}>Enregistrer la tablature</button>
      </div>
    </div>
  );
}
