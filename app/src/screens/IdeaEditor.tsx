import { useEffect, useRef, useState } from 'react';
import { KIND_LABEL, MOODS, STYLES, type Idea, type IdeaKind } from '../lib/ideas';
import { KEY_FR } from '../lib/music';
import { useDialog } from '../lib/useDialog';

export const IDEA_BPM = { min: 40, max: 240 };

/**
 * Bottom sheet to name and tag an idea: title, type, key, tempo (with tap), style, mood, and the
 * text for lyrics. Grids are edited on their own screen, not here.
 */
export function IdeaEditor({ idea, isNew, onSave, onClose }: {
  idea: Idea; isNew?: boolean; onSave: (i: Idea) => void; onClose: () => void;
}) {
  const [title, setTitle] = useState(idea.title);
  const [kind, setKind] = useState<IdeaKind>(idea.kind);
  const [key, setKey] = useState<number | undefined>(idea.key);
  const [minor, setMinor] = useState(!!idea.minor);
  const [bpm, setBpm] = useState<number | undefined>(idea.bpm);
  const [style, setStyle] = useState(idea.style);
  const [mood, setMood] = useState(idea.mood);
  const [text, setText] = useState(idea.text ?? '');
  const [tapFlash, setTapFlash] = useState(false);
  const taps = useRef<number[]>([]);
  const titleRef = useRef<HTMLInputElement>(null);
  const dlg = useDialog(onClose);

  // A fresh recording gets a dated title: select it so typing replaces it.
  useEffect(() => { if (isNew) titleRef.current?.select(); }, [isNew]);

  const audio = idea.kind === 'riff' || idea.kind === 'memo';
  const clampBpm = (n: number) => Math.max(IDEA_BPM.min, Math.min(IDEA_BPM.max, n));
  const tap = () => {
    const now = performance.now();
    const t = taps.current.filter(x => now - x < 2000).concat(now).slice(-5);
    taps.current = t;
    if (t.length >= 2) setBpm(clampBpm(Math.round(60000 / ((t[t.length - 1] - t[0]) / (t.length - 1)))));
    setTapFlash(true);
    window.setTimeout(() => setTapFlash(false), 120);
  };

  const save = () => {
    const name = title.trim();
    if (!name) return;
    onSave({
      ...idea, title: name, kind, key, minor: key == null ? undefined : minor || undefined, bpm, style, mood,
      text: idea.kind === 'paroles' ? text : idea.text,
    });
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="set-sheet idea-sheet" ref={dlg} role="dialog" aria-label={isNew ? 'Nommer l’idée' : 'Modifier l’idée'} onClick={e => e.stopPropagation()}>
        <div className="set-sheet-head">
          <span className="kicker sheet-kicker">{isNew ? 'Nouvelle idée' : 'Modifier l’idée'}</span>
          <button className="player-close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <label className="sheet-field">
          <span>Nom</span>
          <input ref={titleRef} className="text-input" value={title} maxLength={60} onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); }} />
        </label>

        {audio && (
          <div className="sheet-field">
            <span>Type</span>
            <div className="seg" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }} role="group" aria-label="Type">
              {(['riff', 'memo'] as const).map(k => (
                <button key={k} className={kind === k ? 'on' : ''} aria-pressed={kind === k} onClick={() => setKind(k)}>{KIND_LABEL[k]}</button>
              ))}
            </div>
          </div>
        )}

        {idea.kind === 'paroles' && (
          <label className="sheet-field">
            <span>Texte</span>
            <textarea className="text-input idea-textarea" value={text} rows={5} onChange={e => setText(e.target.value)} placeholder="Quelques vers…" />
          </label>
        )}

        <div className="sheet-field">
          <span>Tonalité</span>
          <div className="idea-key-row">
            <label className={'fsel idea-key' + (key != null ? ' on' : '')}>
              <span className="fsel-text">{key == null ? 'Aucune' : KEY_FR[key]}</span>
              <span className="fsel-caret">▾</span>
              <select aria-label="Tonalité" value={key ?? ''} onChange={e => setKey(e.target.value === '' ? undefined : Number(e.target.value))}>
                <option value="">Aucune</option>
                {KEY_FR.map((k, i) => <option key={i} value={i}>{k}</option>)}
              </select>
            </label>
            <div className="seg" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))', flex: 1 }} role="group" aria-label="Mode">
              <button className={key != null && !minor ? 'on' : ''} disabled={key == null} aria-pressed={!minor} onClick={() => setMinor(false)}>Majeur</button>
              <button className={key != null && minor ? 'on' : ''} disabled={key == null} aria-pressed={minor} onClick={() => setMinor(true)}>Mineur</button>
            </div>
          </div>
        </div>

        <div className="sheet-field">
          <span>Tempo</span>
          <div className="idea-bpm-row">
            <div className="mini-stepper">
              <button onClick={() => setBpm(clampBpm((bpm ?? 91) - 1))} aria-label="Moins 1 BPM">−</button>
              <span className="mono idea-bpm">{bpm ? `${bpm} BPM` : '—'}</span>
              <button onClick={() => setBpm(clampBpm((bpm ?? 89) + 1))} aria-label="Plus 1 BPM">+</button>
            </div>
            <button className={'idea-tap' + (tapFlash ? ' hit' : '')} onPointerDown={tap}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(); } }}>Tap</button>
            {bpm != null && <button className="idea-clear" onClick={() => setBpm(undefined)} aria-label="Effacer le tempo">Effacer</button>}
          </div>
        </div>

        <ChipField label="Style" options={STYLES} value={style} onChange={setStyle} />
        <ChipField label="Humeur" options={MOODS} value={mood} onChange={setMood} />

        <button className="btn-primary" disabled={!title.trim()} onClick={save}>Enregistrer</button>
        {isNew && <button className="btn-link" onClick={onClose}>Plus tard</button>}
      </div>
    </div>
  );
}

/** Pick one value, or none (touch the chosen one again). */
function ChipField({ label, options, value, onChange }: { label: string; options: string[]; value?: string; onChange: (v?: string) => void }) {
  return (
    <div className="sheet-field">
      <span>{label}</span>
      <div className="idea-chips" role="group" aria-label={label}>
        {options.map(o => (
          <button key={o} className={'chip idea-chip' + (value === o ? ' on-cream' : '')} aria-pressed={value === o} onClick={() => onChange(value === o ? undefined : o)}>{o}</button>
        ))}
      </div>
    </div>
  );
}
