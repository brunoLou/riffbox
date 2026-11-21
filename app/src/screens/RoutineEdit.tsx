import { useState } from 'react';
import { Phone, StatusBar, TabBar, useBack } from '../components/Chrome';
import {
  DEFAULT_ROUTINE, STEP_LIMITS, STEP_TOOLS, routine, routineSteps, shortOf, type RoutineStep,
} from '../lib/routine';
import './Routine.css';

const sameSteps = (a: RoutineStep[], b: RoutineStep[]) => JSON.stringify(a) === JSON.stringify(b);

/** Edit the daily routine: steps, length, instructions, tool to open. Saved with « Enregistrer ». */
export default function RoutineEdit() {
  const back = useBack('/pratiquer/routine');
  const [draft, setDraft] = useState<RoutineStep[]>(() => routineSteps().map(s => ({ ...s })));
  const [confirmReset, setConfirmReset] = useState(false);

  const total = draft.reduce((t, s) => t + s.min, 0);
  const changed = !sameSteps(draft, routineSteps());
  const valid = draft.every(s => s.name.trim());
  const isDefault = sameSteps(draft, DEFAULT_ROUTINE);

  const edit = (i: number, patch: Partial<RoutineStep>) => setDraft(d => d.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, dir: -1 | 1) => setDraft(d => {
    const n = [...d];
    [n[i], n[i + dir]] = [n[i + dir], n[i]];
    return n;
  });
  const add = () => setDraft(d => [...d, { id: 'step' + Date.now().toString(36), name: '', short: '', detail: '', min: 5 }]);

  const save = () => {
    // The short text (home card) is only rewritten when the name or the instructions changed.
    const known = new Map([...DEFAULT_ROUTINE, ...routineSteps()].map(x => [x.id, x]));
    routine.setSteps(draft.map(s => {
      const name = s.name.trim(), detail = s.detail.trim();
      const was = known.get(s.id);
      const short = was && was.name === name && was.detail === detail ? was.short : shortOf(name, detail);
      return { ...s, name, detail, short };
    }));
    back();
  };

  return (
    <Phone label="07c Routine · modifier">
      <StatusBar />
      <div className="redit-scroll">
        <div className="head">
          <button className="btn-link redit-cancel" onClick={back}>Annuler</button>
          <div className="head-titles" style={{ alignItems: 'center' }}>
            <span className="kicker">Routine du jour</span>
            <h1 className="display" style={{ fontSize: 26 }}>MODIFIER</h1>
          </div>
          <button className="edit-btn on" disabled={!changed || !valid} onClick={save}>Enregistrer</button>
        </div>

        <p className="redit-total"><b className="mono">{total} min</b> au total · c’est aussi votre objectif quotidien</p>

        {draft.map((s, i) => (
          <div key={s.id} className="redit-card" data-step={i + 1}>
            <div className="redit-top">
              <span className="rstep-dot">{i + 1}</span>
              <input className="text-input redit-name" value={s.name} maxLength={24} placeholder="Nom de l’étape"
                aria-label={`Nom de l’étape ${i + 1}`} onChange={e => edit(i, { name: e.target.value })} />
              <div className="redit-order">
                <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Monter l’étape ${i + 1}`}>↑</button>
                <button onClick={() => move(i, 1)} disabled={i === draft.length - 1} aria-label={`Descendre l’étape ${i + 1}`}>↓</button>
              </div>
            </div>

            <textarea className="text-input redit-detail" rows={2} value={s.detail} maxLength={160} placeholder="Consigne : quoi travailler, comment"
              aria-label={`Consigne de l’étape ${i + 1}`} onChange={e => edit(i, { detail: e.target.value })} />

            <div className="redit-row">
              <div className="mini-stepper">
                <button onClick={() => edit(i, { min: Math.max(STEP_LIMITS.minMin, s.min - 1) })} disabled={s.min <= STEP_LIMITS.minMin} aria-label={`Étape ${i + 1} : une minute de moins`}>−</button>
                <span className="mono">{s.min} min</span>
                <button onClick={() => edit(i, { min: Math.min(STEP_LIMITS.maxMin, s.min + 1) })} disabled={s.min >= STEP_LIMITS.maxMin} aria-label={`Étape ${i + 1} : une minute de plus`}>+</button>
              </div>
              <label className={'fsel redit-tool' + (s.link ? ' on' : '')}>
                <span className="fsel-text">{s.link ? STEP_TOOLS.find(t => t.to === s.link!.to)?.name ?? s.link.label : 'Aucun outil'}</span>
                <span className="fsel-caret">▾</span>
                <select aria-label={`Outil de l’étape ${i + 1}`} value={s.link?.to ?? ''}
                  onChange={e => { const t = STEP_TOOLS.find(x => x.to === e.target.value); edit(i, { link: t ? { label: t.label, to: t.to } : undefined }); }}>
                  <option value="">Aucun outil</option>
                  {STEP_TOOLS.map(t => <option key={t.to} value={t.to}>{t.name}</option>)}
                </select>
              </label>
            </div>

            {draft.length > 1 && (
              <button className="redit-remove" onClick={() => setDraft(d => d.filter((_, j) => j !== i))}>Retirer cette étape</button>
            )}
          </div>
        ))}

        {draft.length < STEP_LIMITS.steps && <button className="redit-add" onClick={add}>+ Ajouter une étape</button>}
        {!valid && <p className="redit-warn">Chaque étape a besoin d’un nom.</p>}

        {confirmReset ? (
          <div className="confirm-row">
            <button className="btn-outline" onClick={() => setConfirmReset(false)}>Garder</button>
            <button className="btn-outline danger" onClick={() => { setDraft(DEFAULT_ROUTINE.map(s => ({ ...s }))); setConfirmReset(false); }}>Rétablir</button>
          </div>
        ) : (
          <button className="btn-link" disabled={isDefault} onClick={() => setConfirmReset(true)}>Rétablir la routine d’origine…</button>
        )}
        <p className="redit-note">Le temps déjà fait aujourd’hui est gardé pour les étapes qui restent.</p>
      </div>
      <TabBar active={2} />
    </Phone>
  );
}
