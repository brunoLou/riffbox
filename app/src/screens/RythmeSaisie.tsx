import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { deleteBlob, getBlob, putBlob } from '../lib/blobs';
import { NOTE_VALUES, barSlots, noteValue, notesLength, strokeText, strokesFromNotes, type RNote, type Rhythm } from '../lib/strum';
import { useStoredState } from '../lib/store';
import { useRhythms } from './Rythme';
import './Rythme.css';

const METERS: { label: string; beats: number; den: 4 | 8 }[] = [
  { label: '4/4', beats: 4, den: 4 }, { label: '3/4', beats: 3, den: 4 }, { label: '2/4', beats: 2, den: 4 },
  { label: '6/8', beats: 6, den: 8 }, { label: '12/8', beats: 12, den: 8 },
];
const photoKey = (id: string) => `rhythm-photo:${id}`;

/** Typing a rhythm from a score, bar by bar: note values, rests and ties become strokes. */
export default function RythmeSaisie() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [mine, setMine] = useRhythms();
  const [, setCurrentId] = useStoredState('rhythm.current', 'm-pop');
  const editing = mine.find(r => r.id === params.get('id'));
  const [id] = useState(() => editing?.id ?? 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5));
  const [name, setName] = useState(editing?.name ?? '');
  const firstSlots = editing?.bars[0]?.slots.length ?? 16;
  const [meterIdx, setMeterIdx] = useState(() => Math.max(0, METERS.findIndex(m => m.den === (editing?.den ?? 4) && barSlots(m.beats, m.den) === firstSlots)));
  const [bpm, setBpm] = useState(editing?.bpm ?? 80);
  const [bars, setBars] = useState<RNote[][]>(editing?.notes ?? [[]]);
  const [chords, setChords] = useState<string[]>(editing?.bars.map(b => b.chord ?? '') ?? ['']);
  const [cur, setCur] = useState(0);
  const [rest, setRest] = useState(false);
  const [tie, setTie] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const camera = useRef<HTMLInputElement>(null);
  const m = METERS[meterIdx];
  const slots = barSlots(m.beats, m.den);

  // The photo of the score stays on this device (it is not synced).
  useEffect(() => {
    let url: string | null = null;
    void getBlob(photoKey(id)).then(b => { if (b) { url = URL.createObjectURL(b); setPhoto(url); } });
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [id]);
  const pickPhoto = async (f: File) => {
    await putBlob(photoKey(id), f);
    setPhoto(old => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(f); });
    setZoom(1);
  };
  const dropPhoto = () => { void deleteBlob(photoKey(id)); setPhoto(null); };

  const bar = bars[cur] ?? [];
  const left = slots - notesLength(bar);
  const setBar = (fn: (b: RNote[]) => RNote[]) => setBars(all => all.map((b, i) => (i === cur ? fn(b) : b)));
  const add = (len: number) => {
    if (len > left) return;
    setBar(b => [...b, { len, ...(rest ? { rest: true } : {}), ...(tie && b.length + (cur > 0 ? 1 : 0) > 0 ? { tie: true } : {}) }]);
    setTie(false);
    // A full bar moves on to the next one.
    if (len === left) {
      if (cur === bars.length - 1) { setBars(all => [...all, []]); setChords(c => [...c, '']); }
      setCur(cur + 1);
    }
  };
  const undo = () => {
    if (!bar.length && cur > 0) { setCur(cur - 1); return; }
    setBar(b => b.slice(0, -1));
  };
  const newBar = (copy: boolean) => {
    setBars(all => [...all.slice(0, cur + 1), copy ? bar.slice() : [], ...all.slice(cur + 1)]);
    setChords(c => [...c.slice(0, cur + 1), copy ? c[cur] ?? '' : '', ...c.slice(cur + 1)]);
    setCur(cur + 1);
  };
  const removeBar = () => {
    if (bars.length === 1) { setBars([[]]); setChords(['']); return; }
    setBars(all => all.filter((_, i) => i !== cur));
    setChords(c => c.filter((_, i) => i !== cur));
    setCur(Math.max(0, cur - 1));
  };

  // Bars left empty at the end are not saved.
  const filled = bars.map((b, i) => ({ b, i })).filter(x => x.b.length);
  const canSave = filled.length > 0;
  const save = () => {
    const r: Rhythm = {
      id, name: name.trim() || 'Rythme recopié', created: editing?.created ?? Date.now(), den: m.den, bpm, source: 'saisie',
      notes: filled.map(x => x.b),
      bars: filled.map(x => ({ slots: strokesFromNotes(x.b, slots), ...(chords[x.i]?.trim() ? { chord: chords[x.i].trim() } : {}) })),
    };
    setMine(list => (editing ? list.map(x => (x.id === id ? r : x)) : [r, ...list]));
    setCurrentId(id);
    nav('/pratiquer/rythme');
  };

  return (
    <Phone label="Recopier un rythme">
      <StatusBar />
      <div className="rythme-scroll">
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/pratiquer/rythme" />
            <div className="head-titles">
              <span className="kicker">Rythme</span>
              <h1 className="display" style={{ fontSize: 26 }}>RECOPIER</h1>
            </div>
          </div>
          <button className="edit-btn on" disabled={!canSave} onClick={save}>Enregistrer</button>
        </div>

        {photo ? (
          <div className="score-photo">
            <div className="score-photo-view"><img src={photo} alt="Photo de la partition" style={{ width: `${zoom * 100}%` }} /></div>
            <div className="score-photo-tools">
              <button className="rhythm-btn" onClick={() => setZoom(z => Math.max(1, z - 0.5))} aria-label="Réduire la photo">−</button>
              <span className="mono">×{zoom}</span>
              <button className="rhythm-btn" onClick={() => setZoom(z => Math.min(4, z + 0.5))} aria-label="Agrandir la photo">+</button>
              <button className="rhythm-btn wide" onClick={() => camera.current?.click()}>Changer</button>
              <button className="rhythm-btn wide" onClick={dropPhoto}>Retirer</button>
            </div>
          </div>
        ) : (
          <button className="btn-outline" onClick={() => camera.current?.click()}>📷 Photo de la partition (pour l’avoir sous les yeux)</button>
        )}
        <input ref={camera} type="file" hidden accept="image/*,application/pdf" aria-label="Photo de la partition"
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void pickPhoto(f); }} />

        <input className="text-input" value={name} maxLength={60} placeholder="Nom (ex. : Couplet de ma chanson)" aria-label="Nom du rythme" onChange={e => setName(e.target.value)} />
        <div className="saisie-row">
          <div className="hscroll" role="group" aria-label="Mesure" style={{ gap: 6 }}>
            {METERS.map((x, i) => (
              <button key={x.label} className={'chip' + (i === meterIdx ? ' on-cream' : '')} aria-pressed={i === meterIdx}
                disabled={bars.some(b => b.length) && i !== meterIdx && barSlots(x.beats, x.den) < Math.max(...bars.map(notesLength))}
                onClick={() => setMeterIdx(i)}>{x.label}</button>
            ))}
          </div>
          <div className="mini-stepper">
            <button onClick={() => setBpm(b => Math.max(30, b - 4))} aria-label="Ralentir">−</button>
            <span className="mono">{bpm} BPM</span>
            <button onClick={() => setBpm(b => Math.min(220, b + 4))} aria-label="Accélérer">+</button>
          </div>
        </div>

        <div className="saisie-bar card">
          <div className="saisie-bar-head">
            <button className="rhythm-btn" disabled={cur === 0} onClick={() => setCur(cur - 1)} aria-label="Mesure précédente">‹</button>
            <span className="rhythm-name">Mesure {cur + 1} / {bars.length}</span>
            <button className="rhythm-btn" disabled={cur === bars.length - 1} onClick={() => setCur(cur + 1)} aria-label="Mesure suivante">›</button>
            <input className="text-input chord-input" value={chords[cur] ?? ''} maxLength={8} placeholder="Accord" aria-label={`Accord de la mesure ${cur + 1}`}
              onChange={e => setChords(c => c.map((x, i) => (i === cur ? e.target.value : x)))} />
          </div>
          <div className="saisie-notes" aria-label="Notes de la mesure">
            {bar.map((n, i) => (
              <span key={i} className={'saisie-note' + (n.rest ? ' rest' : '') + (n.tie ? ' tie' : '')} title={(n.rest ? 'Silence : ' : '') + (noteValue(n.len)?.label ?? '')}>
                {n.tie && <i>⌒</i>}{n.rest ? 'silence ' : ''}{noteValue(n.len)?.short}
              </span>
            ))}
            {!bar.length && <span className="saisie-hint">Touchez les valeurs de notes dans l’ordre de la partition.</span>}
          </div>
          <div className="saisie-strokes mono" aria-label="Coups obtenus">{strokeText(strokesFromNotes(bar, slots))}</div>
          <span className="saisie-left">{left ? `Reste ${left % 4 === 0 && m.den === 4 ? `${left / 4} temps` : `${left} double${left > 1 ? 's' : ''} croche${left > 1 ? 's' : ''}`}` : 'Mesure complète'}</span>
        </div>

        <div className="saisie-pad" role="group" aria-label="Valeurs de notes">
          {NOTE_VALUES.map(v => (
            <button key={v.len} className="saisie-key" disabled={v.len > left} onClick={() => add(v.len)} aria-label={(rest ? 'Silence : ' : '') + v.label}>
              <span className="saisie-sym">{v.short}</span><span className="saisie-lbl">{v.label}</span>
            </button>
          ))}
        </div>
        <div className="saisie-mods">
          <button className={'blue-btn small' + (rest ? ' on' : '')} aria-pressed={rest} onClick={() => setRest(!rest)}><span className="blue-led" />Silence</button>
          <button className={'blue-btn small' + (tie ? ' on' : '')} aria-pressed={tie} onClick={() => setTie(!tie)}><span className="blue-led" />Liée à la précédente</button>
          <button className="rhythm-btn wide" onClick={undo} aria-label="Effacer la dernière note">⌫</button>
        </div>
        <div className="saisie-mods">
          <button className="btn-outline" onClick={() => newBar(true)}>Dupliquer la mesure</button>
          <button className="btn-outline" onClick={() => newBar(false)}>+ Mesure</button>
          <button className="btn-outline danger" onClick={removeBar}>Supprimer</button>
        </div>
        <p className="saisie-help">Une note jouée = un coup. Un silence ou une note liée = un coup « dans le vide » : la main continue son va-et-vient sans toucher les cordes. Les flèches suivent ce va-et-vient : ↓ sur les temps, ↑ entre les temps.</p>
      </div>
      <TabBar active={2} />
    </Phone>
  );
}
