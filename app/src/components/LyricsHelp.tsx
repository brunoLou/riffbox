import { useEffect, useMemo, useState } from 'react';
import { analyseLyrics, findRhymes, indexWords, lastWord, type RhymeEntry } from '../lib/lyrics';
import { useDialog } from '../lib/useDialog';
import './LyricsHelp.css';

/** The rhyme dictionary, loaded on first use (its own file, kept offline like the rest). */
let index: Promise<Map<string, RhymeEntry[]>> | null = null;
const loadIndex = () => (index ??= import('../data/mots-fr.json').then(m => indexWords(m.default as string[])));

/**
 * « Rimes » tab of the song editor: each lyric line with its syllables and its rhyme letter;
 * touching a line looks for rhymes to its last word.
 */
export function LyricsHelp({ chordpro }: { chordpro: string }) {
  const sections = useMemo(() => analyseLyrics(chordpro), [chordpro]);
  const [word, setWord] = useState<string | null>(null);

  if (!sections.length) return <p className="help lyr-empty">Écrivez des paroles dans « Écrire » : leurs syllabes et leurs rimes s’affichent ici.</p>;
  return (
    <div className="lyr-help">
      <p className="help">Syllabes chantées (règle classique : le e muet compte devant une consonne). Les lignes qui riment ensemble portent la même lettre. Touchez une ligne pour chercher des rimes.</p>
      {sections.map((s, si) => (
        <div key={si} className="lyr-sec">
          {(s.label || s.lines.length > 1) && (
            <div className="lyr-sec-head">
              <span className="kicker">{s.label || 'Paroles'}</span>
              {s.lines.length > 1 && <span className="lyr-usual">environ {s.usual} syllabes</span>}
            </div>
          )}
          {s.lines.map(l => (
            <button key={l.index} className="lyr-line" onClick={() => setWord(lastWord(l.text))}
              aria-label={`${l.text} : ${l.syllables} syllabes${l.letter ? `, rime ${l.letter}` : ''}${l.odd ? ', longueur inhabituelle' : ''}. Chercher des rimes`}>
              <span className="lyr-letter" data-l={l.letter || undefined}>{l.letter}</span>
              <span className="lyr-text">{l.text}</span>
              <span className={'lyr-count mono' + (l.odd ? ' odd' : '')}>{l.syllables}</span>
            </button>
          ))}
        </div>
      ))}
      {word && <RhymeSheet word={word} onClose={() => setWord(null)} />}
    </div>
  );
}

function RhymeSheet({ word: first, onClose }: { word: string; onClose: () => void }) {
  const [word, setWord] = useState(first);
  const [idx, setIdx] = useState<Map<string, RhymeEntry[]> | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const dlg = useDialog(onClose);
  useEffect(() => { let live = true; void loadIndex().then(i => live && setIdx(i)); return () => { live = false; }; }, []);
  const res = useMemo(() => (idx && word.trim() ? findRhymes(word.trim(), idx, 40) : null), [idx, word]);

  const copy = (w: string) => { void navigator.clipboard?.writeText(w).catch(() => {}); setCopied(w); };
  const list = (title: string, items: RhymeEntry[]) => items.length > 0 && (
    <div className="rhyme-group">
      <span className="rhyme-group-title">{title}</span>
      <div className="rhyme-words">
        {items.map(e => (
          <button key={e.w} className={'rhyme-word' + (copied === e.w ? ' on' : '')} onClick={() => copy(e.w)} aria-label={`${e.w}, ${e.syl} syllabe${e.syl > 1 ? 's' : ''} : copier`}>
            {e.w}<span className="rhyme-syl">{e.syl}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="set-sheet rhyme-sheet" ref={dlg} role="dialog" aria-label="Chercher des rimes" onClick={e => e.stopPropagation()}>
        <div className="set-sheet-head">
          <span className="kicker sheet-kicker">Rimes</span>
          <button className="player-close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <label className="sheet-field">
          <span>Rimes avec</span>
          <input className="text-input" value={word} onChange={e => { setWord(e.target.value); setCopied(null); }} autoCapitalize="none" spellCheck={false} />
        </label>
        {!idx ? <p className="sheet-empty">Chargement du dictionnaire…</p>
          : res && (res.rich.length + res.others.length ? <>
            {list('Rimes riches', res.rich)}
            {list('Rimes', res.others)}
            <p className="help">Le chiffre donne les syllabes. Touchez un mot pour le copier.{copied && <> « {copied} » copié.</>}</p>
          </> : <p className="sheet-empty">Aucune rime trouvée pour « {word} ».</p>)}
      </div>
    </div>
  );
}
