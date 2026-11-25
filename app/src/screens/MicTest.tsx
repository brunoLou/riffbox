import { useEffect, useRef, useState } from 'react';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { NOTE_L } from '../lib/music';
import { hzToMidi } from '../lib/pitch';
import { LOUD_DB, QUIET_DB, audioInputs, roomLabel, startMicCheck, verdict, type MicCheck, type MicFrame } from '../lib/micCheck';
import { useStoredState } from '../lib/store';
import './MicTest.css';

const MIN_DB = -70;
const pct = (db: number) => Math.max(0, Math.min(100, ((db - MIN_DB) / -MIN_DB) * 100));
const noteName = (hz: number) => { const m = Math.round(hzToMidi(hz)); return `${NOTE_L[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`; };

type Guitar = 'acoustique' | 'electrique';
const TIPS: Record<Guitar, string[]> = {
  acoustique: [
    'Téléphone à 30–50 cm de la rosace, micro (bas du téléphone) tourné vers la guitare.',
    'Pas collé à la caisse : les basses grossissent et le son sature.',
    'Grattez normalement : un accord trop fort écrase les notes aiguës.',
  ],
  electrique: [
    'Sans ampli, le micro n’entend que les cordes à vide : branchez un ampli, même petit.',
    'Micro à 30–50 cm du haut-parleur, volume moyen, son clair (sans distorsion ni chorus).',
    'Le plus fiable : une interface audio USB (≈ 50–100 €) qui branche la guitare au téléphone ou à l’ordinateur. Choisissez-la ensuite dans « Micro utilisé ».',
  ],
};

/** Microphone check: level, room noise and what the app hears, to place the phone well. */
export default function MicTest() {
  const [guitar, setGuitar] = useStoredState<Guitar>('mictest.guitar', 'acoustique');
  const [deviceId, setDeviceId] = useStoredState<string>('mictest.device', '');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [state, setState] = useState<'off' | 'starting' | 'on' | 'denied' | 'unsupported'>('off');
  const [frame, setFrame] = useState<MicFrame | null>(null);
  const [peakHold, setPeakHold] = useState(MIN_DB);
  const [clips, setClips] = useState(0);
  const [room, setRoom] = useState<number | null>(null);
  const [noteOk, setNoteOk] = useState<string | null>(null);
  const [chordOk, setChordOk] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const check = useRef<MicCheck | null>(null);
  /** The first two seconds: the player keeps quiet while the room is measured. */
  const silence = useRef<number[] | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const lastNote = useRef<{ n: string; count: number }>({ n: '', count: 0 });
  const hold = useRef({ db: MIN_DB, at: 0 });

  const stop = () => { check.current?.stop(); check.current = null; setState('off'); setFrame(null); };
  useEffect(() => () => check.current?.stop(), []);
  // Leaving the screen (phone locked, other app) releases the microphone.
  useEffect(() => {
    const onHide = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  const measureRoom = () => { silence.current = []; setMeasuring(true); };
  const start = async (id = deviceId) => {
    check.current?.stop();
    setState('starting');
    lastNote.current = { n: '', count: 0 }; hold.current = { db: MIN_DB, at: 0 };
    setClips(0); setRoom(null); setNoteOk(null); setChordOk(null); setPeakHold(MIN_DB);
    try {
      const known = (await audioInputs()).some(d => d.deviceId === id);
      check.current = await startMicCheck(known ? id : null, f => {
        setFrame(f);
        const now = performance.now();
        const pDb = 20 * Math.log10(Math.max(f.peak, 1e-5));
        if (pDb > hold.current.db || now - hold.current.at > 1500) { hold.current = { db: pDb, at: now }; setPeakHold(pDb); }
        if (f.clipped) setClips(c => c + 1);
        const quiet = silence.current;
        if (quiet) {
          quiet.push(f.rmsDb);
          if (quiet.length >= 25) { // 2 seconds: the median, so a cough does not count
            setRoom(quiet.slice().sort((a, b) => a - b)[Math.floor(quiet.length / 2)]);
            silence.current = null;
            setMeasuring(false);
          }
          return;
        }
        if (f.chord && f.rmsDb >= QUIET_DB && !f.clipped) setChordOk(f.chord);
        else if (f.hz && f.rmsDb >= QUIET_DB) {
          // A note counts once it is heard the same for half a second.
          const n = noteName(f.hz);
          lastNote.current = n === lastNote.current.n ? { n, count: lastNote.current.count + 1 } : { n, count: 1 };
          if (lastNote.current.count >= 6) setNoteOk(n);
        }
      });
      setLabel(check.current.label);
      measureRoom();
      setState('on');
      // Device names are only given once the microphone is allowed.
      setDevices(await audioInputs());
    } catch (e) {
      setState((e as Error).message === 'unsupported' ? 'unsupported' : 'denied');
    }
  };

  const v = frame ? verdict(frame.rmsDb, frame.peak) : null;
  const top = frame ? Math.max(...frame.chroma) : 0;

  return (
    <Phone label="Test du micro">
      <StatusBar />
      <div className="mic-scroll">
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/reglages" />
            <div className="head-titles">
              <span className="kicker">Réglages</span>
              <h1 className="display" style={{ fontSize: 28 }}>TEST DU MICRO</h1>
            </div>
          </div>
        </div>

        <div className="seg" role="group" aria-label="Guitare" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
          <button className={guitar === 'acoustique' ? 'on' : ''} aria-pressed={guitar === 'acoustique'} onClick={() => setGuitar('acoustique')}>Acoustique</button>
          <button className={guitar === 'electrique' ? 'on' : ''} aria-pressed={guitar === 'electrique'} onClick={() => setGuitar('electrique')}>Électrique</button>
        </div>

        {state !== 'on' ? (
          <div className="mic-start card">
            <p>Jouez comme d’habitude : le test montre si le son arrive assez fort, sans saturer, et ce que l’app reconnaît.</p>
            <button className="btn-primary" disabled={state === 'starting'} onClick={() => void start()}>{state === 'starting' ? 'Ouverture du micro…' : '🎙 Commencer le test'}</button>
            {state === 'denied' && <p className="mic-warn" role="alert">Micro refusé ou introuvable. Autorisez le micro pour ce site dans le navigateur (icône à gauche de l’adresse), puis réessayez.</p>}
            {state === 'unsupported' && <p className="mic-warn" role="alert">Ce navigateur ne donne pas accès au micro.</p>}
          </div>
        ) : (
          <>
            <div className={'mic-level card k-' + (v?.kind ?? 'silence')} role="status" aria-live="polite">
              <div className="mic-level-head">
                <span className="mic-verdict">{v?.label ?? '…'}</span>
                <span className="mono mic-db">{frame ? `${Math.round(frame.rmsDb)} dB` : ''}</span>
              </div>
              <div className="mic-meter" aria-hidden>
                <span className="zone low" style={{ width: `${pct(QUIET_DB)}%` }} />
                <span className="zone good" style={{ left: `${pct(QUIET_DB)}%`, width: `${pct(LOUD_DB) - pct(QUIET_DB)}%` }} />
                <span className="zone hot" style={{ left: `${pct(LOUD_DB)}%`, width: `${pct(-1) - pct(LOUD_DB)}%` }} />
                <span className="zone clip" style={{ left: `${pct(-1)}%`, right: 0 }} />
                <span className="mic-fill" style={{ width: `${frame ? pct(frame.rmsDb) : 0}%` }} />
                <span className="mic-hold" style={{ left: `${pct(peakHold)}%` }} />
              </div>
              <div className="mic-scale mono" aria-hidden><span>trop faible</span><span>bon</span><span>saturé</span></div>
              <p className="mic-tip">{v?.tip}</p>
              {clips > 0 && <p className="mic-warn">Saturation détectée {clips} fois depuis le début du test.</p>}
            </div>

            {measuring && <p className="mic-silence" role="status">🤫 Ne jouez pas : mesure du bruit de la pièce (2 s)…</p>}
            <div className="mic-hear card">
              <span className="kicker">Ce que l’app entend</span>
              <div className="mic-hear-main">
                {frame?.chord ? <><span className="mic-big">{frame.chord}</span><span className="mic-small">accord</span></>
                  : frame?.hz ? <><span className="mic-big">{noteName(frame.hz)}</span><span className="mic-small">{Math.round(frame.hz)} Hz</span></>
                  : <span className="mic-small">Jouez une note ou un accord…</span>}
              </div>
              <div className="mic-chroma" aria-label="Notes entendues">
                {NOTE_L.map((n, pc) => {
                  const h = frame && top > 0 ? frame.chroma[pc] / top : 0;
                  return (
                    <div key={n} className={'mic-bar' + (h > 0.35 ? ' on' : '')}>
                      <span style={{ height: `${Math.round(h * 100)}%` }} />
                      <b>{n}</b>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mic-checks card">
              <span className="kicker">Vérifications</span>
              <div className="mic-check-row">
                <Check ok={room !== null && room < -45} wait={room === null}
                  text={room === null ? 'Bruit de la pièce : mesure en cours…' : `${roomLabel(room)} (${Math.round(room)} dB)`} />
                {room !== null && !measuring && <button className="mic-remeasure" onClick={measureRoom}>Remesurer</button>}
              </div>
              <Check ok={!!noteOk} text={noteOk ? `Note seule reconnue : ${noteOk}` : 'Jouez une note seule et laissez-la sonner (corde de Mi grave à vide, par exemple)'} />
              <Check ok={!!chordOk} text={chordOk ? `Accord reconnu sans saturer : ${chordOk}` : 'Grattez un accord simple (Mi mineur, La, Ré…) et laissez-le sonner'} />
              <Check ok={clips === 0} text={clips === 0 ? 'Aucune saturation' : 'Le son a saturé : reculez ou baissez le volume'} />
            </div>

            <button className="btn-outline" onClick={stop}>Arrêter le test</button>
          </>
        )}

        {devices.length > 1 && (
          <label className="mic-device">
            <span className="kicker">Micro utilisé</span>
            <select value={devices.some(d => d.deviceId === deviceId) ? deviceId : ''} onChange={e => { setDeviceId(e.target.value); if (state === 'on') void start(e.target.value); }}>
              <option value="">Micro par défaut{label && !deviceId ? ` (${label})` : ''}</option>
              {devices.filter(d => d.deviceId && d.deviceId !== 'default').map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Micro ${i + 1}`}</option>)}
            </select>
          </label>
        )}

        <div className="mic-tips card">
          <span className="kicker">Conseils · guitare {guitar === 'acoustique' ? 'acoustique' : 'électrique'}</span>
          <ul>{TIPS[guitar].map(t => <li key={t}>{t}</li>)}</ul>
        </div>
      </div>
      <TabBar active={0} />
    </Phone>
  );
}

function Check({ ok, wait, text }: { ok: boolean; wait?: boolean; text: string }) {
  return (
    <div className={'mic-check' + (ok ? ' ok' : wait ? ' wait' : '')}>
      <span className="mic-check-dot" aria-hidden>{ok ? '✓' : wait ? '…' : '○'}</span>
      <span>{text}</span>
      <span className="sr-only">{ok ? ' : réussi' : ' : pas encore'}</span>
    </div>
  );
}
