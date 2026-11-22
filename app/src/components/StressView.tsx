import { useMemo, useState } from 'react';
import { alignAll, alignChords, lineSyllables, misplacedChords, splitChords } from '../lib/stress';
import './StressView.css';

/**
 * « Temps » tab of the song editor: the stressed syllables of each line (where the strong beats
 * fall) and the chords set on a weak syllable, with a way to move them onto the stress.
 */
export function StressView({ chordpro, onChange }: { chordpro: string; onChange: (text: string) => void }) {
  const [undo, setUndo] = useState<{ text: string; msg: string } | null>(null);
  const lines = useMemo(() => chordpro.split('\n').map((raw, i) => {
    const sec = raw.match(/^\s*\{(?:c|comment)(?::\s*(.*))?\}\s*$/);
    if (sec) return { kind: 'section' as const, i, label: sec[1] ?? '' };
    if (/^\s*\{.*\}\s*$/.test(raw)) return null;
    const { text, chords } = splitChords(raw);
    const syl = lineSyllables(text);
    if (!syl.length) return null;
    return { kind: 'line' as const, i, raw, text, chords, syl, wrong: misplacedChords(raw) };
  }).filter(<T,>(x: T | null): x is T => x !== null), [chordpro]);
  const total = lines.reduce((n, l) => n + (l.kind === 'line' ? l.wrong.length : 0), 0);

  const change = (text: string, msg: string) => { setUndo({ text: chordpro, msg }); onChange(text); };
  const fixLine = (i: number, which: number[], msg: string) =>
    change(chordpro.split('\n').map((l, k) => (k === i ? alignChords(l, which) : l)).join('\n'), msg);
  const fixAll = () => { const r = alignAll(chordpro); change(r.text, `${r.moved} accord${r.moved > 1 ? 's' : ''} calé${r.moved > 1 ? 's' : ''} sur les temps forts.`); };

  if (!lines.some(l => l.kind === 'line')) return <p className="help">Écrivez des paroles dans « Écrire » : leurs temps forts s’affichent ici.</p>;
  return (
    <div className="stress-view">
      <p className="help">
        En français, l’accent tombe sur la dernière syllabe prononcée d’un mot, plus fort en fin de vers ou avant une virgule :
        c’est là que l’accord change le mieux. <b className="st-key s3">Fort</b> <b className="st-key s2">accentué</b> <span className="st-key s0">e muet</span>
      </p>
      <div className="stress-bar">
        <button className="btn-primary" onClick={fixAll} disabled={!total}>
          {total ? `Caler ${total} accord${total > 1 ? 's' : ''} sur les temps forts` : 'Tous les accords sont sur un temps fort'}
        </button>
        {undo && (
          <p className="backup-msg" role="status">{undo.msg} <button className="btn-link" onClick={() => { onChange(undo.text); setUndo(null); }}>Annuler</button></p>
        )}
      </div>
      {lines.map(l => l.kind === 'section' ? <div key={l.i} className="kicker st-sec">{l.label}</div> : (
        <div key={l.i} className={'st-line' + (l.wrong.length ? ' wrong' : '')}>
          <p className="st-text">{renderLine(l.text, l.syl, l.chords, l.wrong.map(w => w.index))}</p>
          {l.wrong.map(w => (
            <button key={w.index} className="st-fix" onClick={() => fixLine(l.i, [w.index], `${w.chord} calé sur « ${w.to.text} ».`)}>
              Caler <b>{w.chord}</b> sur « {w.to.text} »
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

type Syl = ReturnType<typeof lineSyllables>[number];
function renderLine(text: string, syl: Syl[], chords: { chord: string; at: number }[], wrong: number[]) {
  const out: JSX.Element[] = [];
  let from = 0;
  syl.forEach((s, k) => {
    if (s.start > from) out.push(<span key={`g${k}`}>{text.slice(from, s.start)}</span>);
    const here = chords.map((c, ci) => ({ ...c, ci })).filter(c => syl.findIndex(x => x.end > c.at) === k);
    out.push(
      <span key={k} className={`st-syl s${s.stress}`}>
        {here.map(c => <span key={c.ci} className={'st-chord' + (wrong.includes(c.ci) ? ' off' : '')}>{c.chord}</span>)}
        {s.text}
      </span>,
    );
    from = s.end;
  });
  if (from < text.length) out.push(<span key="end">{text.slice(from)}</span>);
  return out;
}
