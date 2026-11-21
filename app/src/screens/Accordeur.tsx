import { useEffect, useRef, useState } from 'react';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { strum } from '../lib/audio';
import { FR, SHARP } from '../lib/music';
import { hzToMidi, startPitch, type PitchTracker } from '../lib/pitch';
import { useStoredState } from '../lib/store';
import {
  BUILTIN_TUNINGS, CUSTOM_KEY, MAX_CUSTOM, RANGE, STANDARD, TUNING_KEY, allTunings, clampString, defaultTuningId,
  findSame, isTight, newTuningId, sameNotes, tuningNotes, type Tuning,
} from '../lib/tunings';
import './Accordeur.css';
import { useDialog } from '../lib/useDialog';

const TICKS: { c: number; h: string; col: string }[] = [];
for (let c = -50; c <= 50; c += 5) {
  TICKS.push({ c, h: c % 25 === 0 ? '24px' : c % 10 === 0 ? '14px' : '9px', col: Math.abs(c) <= 5 ? '#2f8a55' : '#5a4a36' });
}
const sharpToGlyph = (s: string) => s.replace('#', '♯');

type Mic = 'starting' | 'on' | 'denied' | 'unsupported';

/** How long without a pitch before the needle is released. */
const HOLD_MS = 450;
const median = (a: number[]) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };

export default function Accordeur() {
  const [auto, setAuto] = useStoredState('tuner.auto', true);
  const [tuningId, setTuningId] = useStoredState(TUNING_KEY, defaultTuningId());
  const [custom, setCustom] = useStoredState<Tuning[]>(CUSTOM_KEY, []);
  const [str, setStr] = useStoredState('tuner.string', 1);
  const [mic, setMic] = useState<Mic>('starting');
  const [reading, setReading] = useState<{ hz: number; cents: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  /** Tuning being created (no id) or edited. */
  const [editing, setEditing] = useState<Tuning | null>(null);

  const tunings = allTunings(custom);
  const pr = tunings.find(t => t.id === tuningId) ?? BUILTIN_TUNINGS[0];
  // Latest settings for the audio callback.
  const cfg = useRef({ auto, str, pr, editing: false });
  cfg.current = { auto, str, pr, editing: !!editing };
  const recent = useRef<number[]>([]);
  const lastHeard = useRef(0);
  const smooth = useRef<number | null>(null);

  // Live pitch from the microphone. Released when the screen is hidden or left.
  useEffect(() => {
    let tracker: PitchTracker | null = null;
    let cancelled = false;
    const onPitch = (hz: number | null) => {
      const now = performance.now();
      // While editing a tuning the reference notes play out loud: don't let the tuner chase them.
      if (cfg.current.editing) return;
      if (hz === null) {
        if (now - lastHeard.current > HOLD_MS) { recent.current = []; smooth.current = null; setReading(null); }
        return;
      }
      lastHeard.current = now;
      recent.current = [...recent.current.slice(-4), hz];
      const f = median(recent.current);
      const m = hzToMidi(f);
      const { auto: isAuto, str: s, pr: p } = cfg.current;
      let target = p.m[s];
      if (isAuto) {
        let best = 0;
        p.m.forEach((n, i) => { if (Math.abs(n - m) < Math.abs(p.m[best] - m)) best = i; });
        target = p.m[best];
        if (best !== s) { setStr(best); smooth.current = null; }
      }
      const raw = (m - target) * 100;
      smooth.current = smooth.current === null ? raw : smooth.current + 0.4 * (raw - smooth.current);
      setReading({ hz: f, cents: smooth.current });
    };
    const start = async () => {
      setMic('starting');
      try {
        const t = await startPitch(onPitch);
        if (cancelled) { t.stop(); return; }
        tracker = t;
        setMic('on');
      } catch (e) {
        if (!cancelled) setMic((e as Error).message === 'unsupported' ? 'unsupported' : 'denied');
      }
    };
    const onVis = () => {
      if (document.hidden) { tracker?.stop(); tracker = null; setReading(null); }
      else if (!tracker) void start();
    };
    void start();
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelled = true; tracker?.stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [attempt, setStr]);

  const midi = pr.m[str];
  const cents = reading?.cents ?? 0;
  const rc = Math.round(cents);
  const inTune = !!reading && Math.abs(rc) <= 3;
  const needle = Math.max(-50, Math.min(50, cents));

  return (
    <Phone label="02 Accordeur">
      <StatusBar />
      <div className="screen-body" style={{ gap: 18 }}>
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/" />
            <h1 className="display" style={{ fontSize: 32 }}>ACCORDEUR</h1>
          </div>
          <button className="auto-toggle" onClick={() => setAuto(!auto)} aria-pressed={auto}>
            <span>Auto</span>
            <span className={'switch' + (auto ? ' on' : '')}><span /></span>
          </button>
        </div>

        <div className="tuner-case">
          <div className="tuner-face">
            {TICKS.map(k => (
              <div key={k.c} className="tick" style={{ transform: `rotate(${k.c * 0.9}deg)` }}>
                <div style={{ height: k.h, background: k.col }} />
              </div>
            ))}
            <div className="face-lbl" style={{ left: 22, top: 52 }}>−50</div>
            <div className="face-lbl face-zero">0</div>
            <div className="face-lbl" style={{ right: 22, top: 52 }}>+50</div>
            <div className="face-cents">CENTS</div>
            <div className={'needle' + (reading ? '' : ' idle')} style={{ transform: `rotate(${needle * 0.9}deg)` }} />
            <div className="hub" />
          </div>
          <div className="tuner-foot">
            <span className="tuner-brand">RIFFBOX · TUNER</span>
            <div className="tuner-ok">
              <span style={{ color: inTune ? 'var(--led)' : '#9b8f7f' }}>JUSTE</span>
              <span className={'led' + (inTune ? ' on' : '')} style={{ width: 12, height: 12, boxShadow: inTune ? '0 0 12px var(--led)' : undefined }} />
            </div>
          </div>
        </div>

        <div className="readout">
          <div className="readout-note">
            <span className="note-big">{sharpToGlyph(SHARP[midi % 12])}</span>
            <span className="note-oct">{Math.floor(midi / 12) - 1}</span>
          </div>
          <div className="readout-info">
            <span className="readout-fr">{FR[midi % 12]} · corde {6 - str}</span>
            {mic === 'on' ? (
              <>
                <span className="mono readout-hz">{reading ? `${reading.hz.toFixed(1)} Hz` : 'Jouez une corde'}</span>
                <span className="mono readout-cents" style={{ color: !reading ? 'var(--muted)' : inTune ? 'var(--led-text)' : 'var(--accent-text)' }}>
                  {!reading ? '— ct' : `${rc > 0 ? '+' : ''}${rc} ct${Math.abs(rc) > 50 ? (rc > 0 ? ' ↓' : ' ↑') : ''}`}
                </span>
              </>
            ) : mic === 'starting' ? (
              <span className="mono readout-hz">Micro…</span>
            ) : (
              <>
                <span className="mic-msg">{mic === 'denied' ? 'Micro refusé' : 'Micro indisponible'}</span>
                {mic === 'denied' && <button className="mic-retry" onClick={() => setAttempt(a => a + 1)}>Réessayer</button>}
              </>
            )}
          </div>
        </div>

        <div className="string-row">
          {pr.m.map((m, i) => (
            <button
              key={i}
              className={'chip string-btn' + (i === str ? ' on-amber' : '')}
              onClick={() => { setStr(i); setAuto(false); smooth.current = null; }}
              aria-pressed={i === str}
            >
              <span className="string-n">{sharpToGlyph(SHARP[m % 12])}</span>
              <span className="string-num">{6 - i}</span>
            </button>
          ))}
        </div>

        <div className="presets">
          <span className="kicker" style={{ padding: '0 4px' }}>Accordage</span>
          <div className="hscroll" style={{ gap: 8 }}>
            {tunings.map(x => (
              <button
                key={x.id}
                className={'chip preset' + (x.custom ? ' preset-custom' : '') + (x.id === pr.id ? ' on-cream' : '')}
                aria-pressed={x.id === pr.id}
                onClick={() => { if (x.id === pr.id && x.custom) setEditing(x); else { setTuningId(x.id); smooth.current = null; } }}
              >
                {x.label}{x.custom && x.id === pr.id && <span className="preset-edit" aria-label="Modifier"> ✎</span>}
              </button>
            ))}
            {custom.length < MAX_CUSTOM && (
              <button className="chip preset preset-add" onClick={() => setEditing({ id: '', label: '', m: [...pr.m] })}>+ Perso</button>
            )}
          </div>
          <span className="tuning-notes mono">{tuningNotes(pr.m)}{pr.custom ? ' · touchez l’accordage pour le modifier' : ''}</span>
        </div>
      </div>
      {editing && (
        <TuningEditor
          initial={editing}
          tunings={tunings}
          onClose={() => setEditing(null)}
          onPick={id => { setTuningId(id); setEditing(null); smooth.current = null; }}
          onSave={t => {
            setCustom(editing.id ? custom.map(c => (c.id === t.id ? t : c)) : [...custom, t]);
            setTuningId(t.id);
            setEditing(null);
            smooth.current = null;
          }}
          onDelete={() => {
            setCustom(custom.filter(c => c.id !== editing.id));
            setTuningId('std');
            setEditing(null);
          }}
        />
      )}
      <TabBar active={0} />
    </Phone>
  );
}

const noteName = (m: number) => `${sharpToGlyph(SHARP[m % 12])}${Math.floor(m / 12) - 1}`;

/** Bottom sheet: name, six strings a semitone at a time, listen, save. */
function TuningEditor({ initial, tunings, onClose, onSave, onPick, onDelete }: {
  initial: Tuning; tunings: Tuning[];
  onClose: () => void; onSave: (t: Tuning) => void; onPick: (id: string) => void; onDelete: () => void;
}) {
  const isNew = !initial.id;
  const [label, setLabel] = useState(initial.label);
  const [m, setM] = useState(initial.m);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dlg = useDialog(onClose);
  const sound = useRef<{ stop(): void } | null>(null);
  useEffect(() => () => sound.current?.stop(), []);

  const play = (notes: number[]) => { sound.current?.stop(); sound.current = strum(notes); };
  const setString = (i: number, d: number) => {
    const v = clampString(i, m[i] + d);
    if (v === m[i]) return;
    const next = m.map((x, j) => (j === i ? v : x));
    setM(next);
    play([v]);
  };
  const canShift = (d: number) => m.every((x, i) => clampString(i, x + d) === x + d);
  const shiftAll = (d: number) => { if (canShift(d)) setM(m.map(x => x + d)); };

  // Only once a string has moved: a new tuning starts as a copy of the current one.
  const touched = !sameNotes(m, initial.m);
  const same = touched ? findSame(tunings, m, initial.id || undefined) : undefined;
  const name = label.trim() || tuningNotes(m);
  const unchanged = isNew ? !touched : !touched && name === initial.label;
  const tight = m.some((x, i) => isTight(i, x));

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="tuning-sheet" ref={dlg} role="dialog" aria-label={isNew ? 'Nouvel accordage' : 'Modifier l’accordage'} onClick={e => e.stopPropagation()}>
        <div className="tuning-sheet-head">
          <span className="kicker" style={{ color: 'var(--accent-text)' }}>{isNew ? 'Nouvel accordage' : 'Modifier l’accordage'}</span>
          <button className="tuning-close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <label className="tuning-field">
          <span>Nom</span>
          <input className="tuning-input" value={label} maxLength={18} placeholder={tuningNotes(m)} onChange={e => setLabel(e.target.value)} />
        </label>

        <div className="tuning-strings">
          {m.map((x, i) => {
            const d = x - STANDARD[i];
            return (
              <div key={i} className={'tuning-string' + (isTight(i, x) ? ' tight' : '')} data-string={6 - i}>
                <span className="tuning-num mono">{6 - i}</span>
                <button className="tuning-step" onClick={() => setString(i, -1)} disabled={d <= -RANGE.down} aria-label={`Corde ${6 - i} : baisser d’un demi-ton`}>−</button>
                <button className="tuning-note" onClick={() => play([x])} aria-label={`Écouter la corde ${6 - i}`}>
                  <b>{noteName(x)}</b><span>{FR[x % 12]}</span>
                </button>
                <button className="tuning-step" onClick={() => setString(i, 1)} disabled={d >= RANGE.up} aria-label={`Corde ${6 - i} : monter d’un demi-ton`}>+</button>
                <span className="tuning-diff mono">{d === 0 ? 'std' : `${d > 0 ? '+' : '−'}${Math.abs(d)}`}</span>
              </div>
            );
          })}
        </div>

        <div className="tuning-tools">
          <button className="tuning-tool" onClick={() => shiftAll(-1)} disabled={!canShift(-1)}>Tout −½ ton</button>
          <button className="tuning-tool" onClick={() => play(m)}>▶ Écouter</button>
          <button className="tuning-tool" onClick={() => shiftAll(1)} disabled={!canShift(1)}>Tout +½ ton</button>
        </div>

        {tight && <p className="tuning-warn">Corde plus aiguë que d’habitude : plus de tension, montez-la doucement.</p>}
        {same && <p className="tuning-same">Mêmes notes que « {same.label} ».</p>}
        {isNew && !touched && <p className="tuning-same">Changez au moins une corde : l’accordage part de « {tunings.find(t => sameNotes(t.m, initial.m))?.label ?? tuningNotes(initial.m)} ».</p>}

        {same && !same.custom
          ? <button className="tuning-save" onClick={() => onPick(same.id)}>Utiliser « {same.label} »</button>
          : <button className="tuning-save" disabled={unchanged} onClick={() => onSave({ id: initial.id || newTuningId(), label: name, m })}>
              {isNew ? 'Enregistrer' : 'Enregistrer les modifications'}
            </button>}

        {!isNew && (confirmDelete
          ? <div className="tuning-confirm">
              <button className="tuning-tool" onClick={() => setConfirmDelete(false)}>Garder</button>
              <button className="tuning-delete on" onClick={onDelete}>Supprimer « {initial.label} »</button>
            </div>
          : <button className="tuning-delete" onClick={() => setConfirmDelete(true)}>Supprimer cet accordage</button>)}
      </div>
    </div>
  );
}
