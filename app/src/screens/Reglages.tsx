import { exportForDaw, listRecordings } from '../lib/dawExport';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import {
  buildBackup, previewMerge, readBackup, restoreMerge, restoreReplace, saveBackup, summarize, type BackupFile,
} from '../lib/backup';
import { blobsBytes, clearBlobs } from '../lib/blobs';
import { SETTINGS } from '../lib/data';
import { SYNC_LISTS, mergeSummary, type MergePlan } from '../lib/sync';
import { dateStamp, shareOrDownload } from '../lib/files';
import { markBackedUp } from '../lib/reminder';
import { LAST_BACKUP_KEY, REMIND_CHOICES, REMIND_DEFAULT, REMIND_KEY, daysAgo } from '../lib/reminder';
import {
  DEFAULT_PEDAL_KEYS, PEDAL_ACTIONS, PEDAL_NAMES, PEDAL_SCREENS, actionFor, assignKey, canBePedal, keyLabel, normKey,
  usePedalKeys, type PedalAction,
} from '../lib/pedal';
import { THEME_KEY, applyTheme, type ThemePref } from '../lib/theme';
import { INITIAL_GRIDS, type Grid } from '../lib/grids';
import { INITIAL_IDEAS, type Idea } from '../lib/ideas';
import { clearDemoPractice, demoPractice, routine } from '../lib/routine';
import { INITIAL_SETLISTS, INITIAL_SONGS, type Setlist, type Song } from '../lib/setlists';
import { clearAllStored, readStored, storedBytes, useStoredState, writeStored } from '../lib/store';
import './Reglages.css';

const DEMO_IDEAS = new Set(INITIAL_IDEAS.map(i => i.id));
const DEMO_SETS = new Set(INITIAL_SETLISTS.map(s => s.id));
const DEMO_GRIDS = new Set(INITIAL_GRIDS.map(g => g.id));
const DEMO_SONGS = new Set(INITIAL_SONGS.map(s => s.id));

const fmtBytes = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} Ko` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`);
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export default function Reglages() {
  const [showStreak, setShowStreak] = useStoredState(SETTINGS.showStreak.key, SETTINGS.showStreak.def);
  const [fontSize, setFontSize] = useStoredState(SETTINGS.stageFontSize.key, SETTINGS.stageFontSize.def);
  const [theme, setTheme] = useStoredState<ThemePref>(THEME_KEY, 'dark');
  const [, refresh] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [audioBytes, setAudioBytes] = useState(0);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    void blobsBytes().then(setAudioBytes);
    void navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  const ideas = readStored<Idea[]>('ideas', INITIAL_IDEAS);
  const sets = readStored<Setlist[]>('setlists', INITIAL_SETLISTS);
  const grids = readStored<Grid[]>('grids', INITIAL_GRIDS);
  const songs = readStored<Song[]>('songs', INITIAL_SONGS);
  const recordings = ideas.filter(i => i.hasAudio).length;
  const demo = {
    ideas: ideas.filter(i => DEMO_IDEAS.has(i.id)).length,
    sets: sets.filter(s => DEMO_SETS.has(s.id)).length,
    grids: grids.filter(g => DEMO_GRIDS.has(g.id)).length,
    songs: songs.filter(s => DEMO_SONGS.has(s.id)).length,
    ...demoPractice(),
  };
  const hasDemo = demo.ideas + demo.sets + demo.grids + demo.songs + demo.days > 0 || demo.routineIsDemo;
  const demoParts = [
    demo.ideas && plural(demo.ideas, 'idée', 'idées'),
    demo.grids && plural(demo.grids, 'grille', 'grilles'),
    demo.songs && plural(demo.songs, 'morceau', 'morceaux'),
    demo.sets && plural(demo.sets, 'setlist', 'setlists'),
    demo.days && plural(demo.days, 'jour d’historique', 'jours d’historique'),
    demo.routineIsDemo && 'la routine du jour entamée',
  ].filter(Boolean) as string[];

  const clearDemo = () => {
    writeStored('ideas', ideas.filter(i => !DEMO_IDEAS.has(i.id)));
    writeStored('grids', grids.filter(g => !DEMO_GRIDS.has(g.id)));
    writeStored('songs', songs.filter(s => !DEMO_SONGS.has(s.id)));
    // User grids that pointed to an example song become their own song again.
    writeStored('grids', readStored<Grid[]>('grids', INITIAL_GRIDS).map(g => (g.songId && DEMO_SONGS.has(g.songId) ? { ...g, songId: undefined } : g)));
    // Remaining setlists lose the example songs and the example grids' songs.
    const gone = new Set([...DEMO_SONGS, ...grids.filter(g => DEMO_GRIDS.has(g.id)).map(g => g.songId ?? `g:${g.id}`)]);
    writeStored('setlists', sets.filter(s => !DEMO_SETS.has(s.id)).map(s => ({ ...s, songIds: s.songIds.filter(id => !gone.has(id)) })));
    clearDemoPractice();
    setCleared(true);
    refresh(n => n + 1);
  };

  const resetAll = async () => {
    routine.pause();
    clearAllStored();
    await clearBlobs();
    window.location.hash = '#/';
    window.location.reload();
  };

  return (
    <Phone label="09 Réglages">
      <StatusBar />
      <div className="settings-scroll">
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/" />
            <div className="head-titles">
              <span className="kicker">Accueil</span>
              <h1 className="display" style={{ fontSize: 30 }}>RÉGLAGES</h1>
            </div>
          </div>
        </div>

        <span className="kicker settings-section">Affichage</span>
        <div className="settings-card">
          <div className="settings-row col">
            <span className="settings-label">Thème</span>
            <div className="seg" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }} role="group" aria-label="Thème">
              {([['dark', 'Sombre'], ['light', 'Clair'], ['auto', 'Automatique']] as const).map(([v, l]) => (
                <button key={v} className={theme === v ? 'on' : ''} aria-pressed={theme === v} onClick={() => { setTheme(v); applyTheme(v); }}>{l}</button>
              ))}
            </div>
            <span className="settings-help">Automatique suit le réglage du téléphone. Le prompteur live reste toujours sombre.</span>
          </div>
          <button className="settings-row" onClick={() => setShowStreak(!showStreak)} aria-pressed={showStreak}>
            <span className="settings-label">Série de jours sur l’accueil</span>
            <span className={'switch' + (showStreak ? ' on' : '')}><span /></span>
          </button>
          <div className="settings-row col">
            <div className="settings-row-top">
              <span className="settings-label">Taille des paroles en live</span>
              <div className="mini-stepper">
                <button onClick={() => setFontSize(Math.max(SETTINGS.stageFontSize.min, fontSize - 2))} disabled={fontSize <= SETTINGS.stageFontSize.min} aria-label="Plus petit">−</button>
                <span className="mono">{fontSize} px</span>
                <button onClick={() => setFontSize(Math.min(SETTINGS.stageFontSize.max, fontSize + 2))} disabled={fontSize >= SETTINGS.stageFontSize.max} aria-label="Plus grand">+</button>
              </div>
            </div>
            <div className="lyric-preview">
              <span className="lyric-chord" style={{ fontSize: Math.round(fontSize * 0.82) }}>A7</span>
              <span className="lyric-text" style={{ fontSize }}>Minuit shuffle</span>
            </div>
          </div>
        </div>

        <span className="kicker settings-section">Pédalier</span>
        <PedalCard />

        <span className="kicker settings-section">Données sur cet appareil</span>
        <div className="settings-card">
          <dl className="data-list">
            <div><dt>Idées</dt><dd>{ideas.length}{recordings ? ` · ${plural(recordings, 'enregistrement', 'enregistrements')}` : ''}</dd></div>
            <div><dt>Grilles</dt><dd>{grids.length}</dd></div>
            <div><dt>Morceaux</dt><dd>{songs.length}</dd></div>
            <div><dt>Setlists</dt><dd>{sets.length}</dd></div>
            <div><dt>Espace utilisé</dt><dd>{fmtBytes(storedBytes() + audioBytes)}</dd></div>
            <div><dt>Protection</dt><dd>{persisted ? 'Stockage protégé' : 'Peut être effacé par le navigateur si l’espace manque'}</dd></div>
          </dl>
          <p className="settings-note">Tout reste sur ce téléphone : rien n’est envoyé sur internet.</p>
        </div>

        <span className="kicker settings-section">Téléphone ⇄ tablette</span>
        <TransferCard />

        <BackupCard />

        <DawCard />

        <div className="settings-card">
          <div className="settings-action">
            <span className="settings-label">Effacer les exemples</span>
            <span className="settings-help">
              {hasDemo
                ? `Retire ${demoParts.join(', ').replace(/, ([^,]*)$/, ' et $1')}. Vos propres idées, grilles, morceaux, setlists et séances sont gardés ; les morceaux d’exemple sortent aussi de vos setlists.`
                : cleared ? 'Les exemples ont été effacés.' : 'Il n’y a plus d’exemples.'}
            </span>
            <button className="btn-outline" onClick={clearDemo} disabled={!hasDemo}>Effacer les exemples</button>
          </div>
        </div>

        <div className="settings-card danger">
          <div className="settings-action">
            <span className="settings-label">Tout réinitialiser</span>
            <span className="settings-help">
              Efface tout : idées, enregistrements, grilles, morceaux, setlists, routine, historique et réglages. L’app repart comme au premier lancement, avec les exemples.
            </span>
            {confirming ? (
              <div className="confirm-row">
                <button className="btn-outline" onClick={() => setConfirming(false)}>Annuler</button>
                <button className="btn-danger" onClick={() => void resetAll()}>Tout effacer</button>
              </div>
            ) : (
              <button className="btn-outline danger" onClick={() => setConfirming(true)}>Tout réinitialiser…</button>
            )}
          </div>
        </div>

        <span className="kicker settings-section">À propos</span>
        <div className="settings-card">
          <Link to="/reglages/design" className="settings-row settings-link">
            <span className="settings-label">Design system</span>
            <span className="settings-chev">Couleurs, typos, composants ›</span>
          </Link>
        </div>

        <p className="settings-foot mono">RIFFBOX 0.1 · fonctionne hors ligne</p>
      </div>
      <TabBar active={0} />
    </Phone>
  );
}

/* ---------- Sauvegarde : export et import ---------- */

/** Pedal keys: learn a key per pedal, try them, see what they do on each screen. */
function PedalCard() {
  const [keys, setKeys] = usePedalKeys();
  const [learning, setLearning] = useState<PedalAction | null>(null);
  const [last, setLast] = useState<{ a: PedalAction | null; key: string; n: number } | null>(null);
  const [msg, setMsg] = useState('');
  const keysRef = useRef(keys);
  keysRef.current = keys;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (learning) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Escape') { setLearning(null); setMsg(''); return; }
        if (!canBePedal(e.key) || e.repeat) return;
        const before = actionFor(keysRef.current, e.key);
        setKeys(assignKey(keysRef.current, learning, e.key));
        setMsg(`${keyLabel(normKey(e.key))} → ${PEDAL_NAMES[learning]}` + (before && before !== learning ? ` (retirée de la ${PEDAL_NAMES[before].toLowerCase()})` : ''));
        setLearning(null);
        return;
      }
      if (!canBePedal(e.key) || e.repeat) return;
      const a = actionFor(keysRef.current, e.key);
      // Pedal keys would otherwise scroll the page or click the focused button.
      if (a) e.preventDefault();
      setLast(l => ({ a, key: normKey(e.key), n: (l?.n ?? 0) + 1 }));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [learning, setKeys]);

  const isDefault = JSON.stringify(keys) === JSON.stringify(DEFAULT_PEDAL_KEYS);

  return (
    <div className="settings-card pedal-card">
      {PEDAL_ACTIONS.map(a => (
        <div key={a} className={'settings-row col pedal-row' + (learning === a ? ' learning' : '')} data-pedal={a}>
          <div className="settings-row-top">
            <span className="settings-label">{PEDAL_NAMES[a]}</span>
            <button className="btn-outline pedal-learn" onClick={() => { setMsg(''); setLearning(learning === a ? null : a); }} aria-pressed={learning === a}>
              {learning === a ? 'Annuler' : 'Apprendre'}
            </button>
          </div>
          {learning === a
            ? <span className="pedal-wait" role="status">Appuyez sur la pédale… (Échap pour annuler)</span>
            : (
              <div className="pedal-keys">
                {keys[a].length ? keys[a].map(k => (
                  <span key={k} className="pedal-key">
                    {keyLabel(k)}
                    <button onClick={() => setKeys({ ...keys, [a]: keys[a].filter(x => x !== k) })} aria-label={`Retirer ${keyLabel(k)} de la ${PEDAL_NAMES[a].toLowerCase()}`}>×</button>
                  </span>
                )) : <span className="settings-help">Aucune touche</span>}
              </div>
            )}
        </div>
      ))}

      <div className="settings-row col">
        <div className="settings-row-top">
          <span className="settings-label">Essai</span>
          <span className={'pedal-try' + (last?.a ? ' on' : '')} key={last?.n} role="status">
            <span className="pedal-try-led" />
            {!last ? 'Appuyez sur une pédale' : last.a ? `${PEDAL_NAMES[last.a]} · ${keyLabel(last.key)}` : `${keyLabel(last.key)} : non attribuée`}
          </span>
        </div>
        {msg && <span className="settings-help pedal-msg">{msg}</span>}
      </div>

      <details className="pedal-help">
        <summary>Ce que font les pédales</summary>
        <table className="pedal-table">
          <thead><tr><th /><th>Droite</th><th>Gauche</th><th>Milieu</th></tr></thead>
          <tbody>
            {PEDAL_SCREENS.map(s => (
              <tr key={s.screen}><th>{s.screen}</th><td>{s.does.right}</td><td>{s.does.left}</td><td>{s.does.middle}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="settings-help">
          Appairez le pédalier dans les réglages Bluetooth du téléphone : il s’y présente comme un clavier.
          Les pédaliers qui imitent les boutons de volume ne peuvent pas être lus par une app web : choisissez un mode flèches ou pages.
        </p>
      </details>

      <div className="settings-action">
        <button className="btn-outline" disabled={isDefault} onClick={() => { setKeys(DEFAULT_PEDAL_KEYS); setMsg('Touches par défaut rétablies.'); }}>Touches par défaut</button>
      </div>
    </div>
  );
}

const LIST_NAMES: Record<string, string> = {
  ideas: 'Idées', grids: 'Grilles', songs: 'Morceaux', setlists: 'Setlists', 'voice.takes': 'Prises vocales', 'tuner.custom': 'Accordages perso',
};
const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : null);

/**
 * Phone ⇄ tablet: send everything to the other device as a file (share sheet), and receive the
 * other device's file: the most recent version of each item wins, nothing is lost.
 */
function TransferCard() {
  const [lastSent, setLastSent] = useStoredState<string | null>('sync.lastSent', null);
  const [lastReceived, setLastReceived] = useStoredState<string | null>('sync.lastReceived', null);
  const [busy, setBusy] = useState<null | 'send' | 'receive'>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [incoming, setIncoming] = useState<{ file: BackupFile; plan: MergePlan } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const send = async () => {
    setBusy('send'); setMsg(null);
    try {
      const b = await buildBackup();
      const d = new Date();
      const name = `riffbox-envoi-${dateStamp(d)}-${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}.json`;
      const how = await shareOrDownload(name, new Blob([JSON.stringify(b)], { type: 'application/json' }), 'RIFFBOX : à recevoir sur l’autre appareil');
      if (how === 'cancelled') { setMsg({ text: 'Envoi annulé.' }); return; }
      setLastSent(b.exportedAt);
      markBackedUp(b.exportedAt); // the data now lives on two devices
      setMsg({ text: how === 'shared'
        ? 'Fichier partagé. Sur l’autre appareil : Réglages › Recevoir, puis choisissez ce fichier.'
        : 'Fichier téléchargé. Envoyez-le sur l’autre appareil, puis : Réglages › Recevoir.' });
    } catch {
      setMsg({ text: 'L’envoi a échoué. Réessayez.', error: true });
    } finally { setBusy(null); }
  };

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setMsg(null);
    try {
      const file = await readBackup(f);
      setIncoming({ file, plan: previewMerge(file) });
    } catch (e) { setIncoming(null); setMsg({ text: (e as Error).message, error: true }); }
    finally { if (input.current) input.current.value = ''; }
  };

  const apply = async () => {
    if (!incoming) return;
    setBusy('receive');
    try {
      const st = await restoreMerge(incoming.file);
      setLastReceived(new Date().toISOString());
      setMsg({ text: `${mergeSummary(st)}. Redémarrage…` });
      setTimeout(() => { window.location.hash = '#/reglages'; window.location.reload(); }, 900);
    } catch {
      setBusy(null);
      setMsg({ text: 'La réception a échoué. Vos données n’ont pas été modifiées.', error: true });
    }
  };

  const changes = incoming ? SYNC_LISTS.map(k => ({ k, s: incoming.plan.byList[k] })).filter(x => x.s && x.s.added + x.s.updated + x.s.removed > 0) : [];
  const nothing = incoming && Object.keys(incoming.plan.writes).length === 0;

  return (
    <div className="settings-card transfer-card">
      <div className="settings-action">
        <span className="settings-help">
          Envoyez vos données à votre autre appareil. À la réception, il garde ce qu’il a, ajoute ce qui manque et prend
          <b> la version la plus récente</b> de chaque idée, grille, morceau ou setlist. Ce que vous avez supprimé reste supprimé.
        </span>
        <div className="confirm-row">
          <button className="btn-primary" onClick={() => void send()} disabled={busy !== null}>{busy === 'send' ? 'Préparation…' : 'Envoyer'}</button>
          <button className="btn-outline" onClick={() => input.current?.click()} disabled={busy !== null}>Recevoir…</button>
        </div>
        <input ref={input} type="file" accept=".json,application/json" hidden onChange={e => void pick(e.target.files?.[0])} aria-label="Fichier reçu de l’autre appareil" />
        {(lastSent || lastReceived) && (
          <span className="settings-help transfer-dates">
            {lastSent && <>Dernier envoi : {when(lastSent)}</>}{lastSent && lastReceived && ' · '}{lastReceived && <>Dernière réception : {when(lastReceived)}</>}
          </span>
        )}
        {msg && <p className={'backup-msg' + (msg.error ? ' error' : '')} role="status">{msg.text}</p>}

        {incoming && busy !== 'receive' && (
          <div className="backup-import transfer-preview">
            <span className="settings-label">Envoyé le {when(incoming.file.exportedAt) ?? 'date inconnue'}</span>
            {nothing ? (
              <span className="settings-help">Cet appareil est déjà à jour : rien à changer.</span>
            ) : (
              <>
                <dl className="data-list">
                  {changes.map(({ k, s: st }) => (
                    <div key={k}><dt>{LIST_NAMES[k]}</dt><dd>{[
                      st.added && `+${st.added} nouveau${st.added > 1 ? 'x' : ''}`,
                      st.updated && `${st.updated} mis à jour`,
                      st.removed && `−${st.removed} supprimé${st.removed > 1 ? 's' : ''}`,
                    ].filter(Boolean).join(' · ')}</dd></div>
                  ))}
                  {changes.length === 0 && <div><dt>Réglages, routine, pratique</dt><dd>mis à jour</dd></div>}
                </dl>
                <button className="btn-primary" onClick={() => void apply()}>Mettre à jour cet appareil</button>
              </>
            )}
            <button className="btn-link" onClick={() => setIncoming(null)}>{nothing ? 'Fermer' : 'Annuler'}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function BackupCard() {
  const [last, setLast] = useStoredState<string | null>(LAST_BACKUP_KEY, null);
  const [remind, setRemind] = useStoredState<number>(REMIND_KEY, REMIND_DEFAULT);
  const [busy, setBusy] = useState<null | 'export' | 'import'>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const doExport = async () => {
    setBusy('export'); setMsg(null);
    try {
      const b = await buildBackup();
      const how = await saveBackup(b);
      if (how === 'cancelled') { setMsg({ text: 'Export annulé.' }); return; }
      setLast(b.exportedAt);
      const n = Object.keys(b.audio).length;
      setMsg({ text: `Sauvegarde ${how === 'shared' ? 'partagée' : 'téléchargée'}${n ? ` avec ${plural(n, 'enregistrement', 'enregistrements')}` : ''}. Gardez ce fichier hors du téléphone.` });
    } catch {
      setMsg({ text: 'L’export a échoué. Réessayez.', error: true });
    } finally { setBusy(null); }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setMsg(null); setConfirmReplace(false);
    try { setPending(await readBackup(f)); }
    catch (e) { setPending(null); setMsg({ text: (e as Error).message, error: true }); }
    finally { if (input.current) input.current.value = ''; }
  };

  const restart = () => { window.location.hash = '#/reglages'; window.location.reload(); };
  const doMerge = async () => {
    if (!pending) return;
    setBusy('import');
    try { const st = await restoreMerge(pending); setMsg({ text: `${mergeSummary(st)}. Redémarrage…` }); setTimeout(restart, 900); }
    catch { setBusy(null); setMsg({ text: 'L’import a échoué. Vos données n’ont pas été modifiées.', error: true }); }
  };
  const doReplace = async () => {
    if (!pending) return;
    setBusy('import');
    routine.pause();
    try { await restoreReplace(pending); setMsg({ text: 'Données remplacées. Redémarrage…' }); setTimeout(restart, 900); }
    catch { setBusy(null); setMsg({ text: 'L’import a échoué en cours de route. Réimportez le fichier.', error: true }); }
  };

  const sum = pending ? summarize(pending) : null;
  const lastLabel = last ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(last)) : null;

  return (
    <div className="settings-card">
      <div className="settings-action">
        <span className="settings-label">Sauvegarde</span>
        <span className="settings-help">
          Un fichier avec toutes vos données et vos enregistrements, pour changer de téléphone ou ne rien perdre.
          {' '}{lastLabel ? `Dernière sauvegarde : ${lastLabel} (${daysAgo(Math.floor((Date.now() - new Date(last!).getTime()) / 86400000))}).` : 'Aucune sauvegarde pour l’instant.'}
        </span>
        <div className="confirm-row">
          <button className="btn-primary" onClick={() => void doExport()} disabled={busy !== null}>{busy === 'export' ? 'Préparation…' : 'Exporter'}</button>
          <button className="btn-outline" onClick={() => input.current?.click()} disabled={busy !== null}>Importer…</button>
        </div>
        <input ref={input} type="file" accept=".json,application/json" hidden onChange={e => void onFile(e.target.files?.[0])} aria-label="Fichier de sauvegarde" />
        {msg && <p className={'backup-msg' + (msg.error ? ' error' : '')} role="status">{msg.text}</p>}
        <span className="settings-label backup-remind-label">Me rappeler de sauvegarder</span>
        <div className="seg" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }} role="group" aria-label="Rappel de sauvegarde">
          {REMIND_CHOICES.map(c => (
            <button key={c.days} className={remind === c.days ? 'on' : ''} aria-pressed={remind === c.days} onClick={() => setRemind(c.days)}>{c.label}</button>
          ))}
        </div>
        <span className="settings-help">
          {remind ? `Un rappel apparaît sur l’accueil quand vos propres idées, morceaux ou setlists n’ont pas été sauvegardés depuis ${REMIND_CHOICES.find(c => c.days === remind)?.label ?? `${remind} jours`}.` : 'Aucun rappel.'}
        </span>

        {pending && sum && busy !== 'import' && (
          <div className="backup-import">
            <span className="settings-label">Sauvegarde du {sum.date}</span>
            <dl className="data-list">
              <div><dt>Idées</dt><dd>{sum.ideas}</dd></div>
              <div><dt>Grilles · morceaux</dt><dd>{sum.grids} · {sum.songs}</dd></div>
              <div><dt>Setlists</dt><dd>{sum.setlists}</dd></div>
              <div><dt>Prises vocales</dt><dd>{sum.takes}</dd></div>
              <div><dt>Enregistrements audio</dt><dd>{sum.recordings}</dd></div>
              <div><dt>Jours de pratique</dt><dd>{sum.days}</dd></div>
            </dl>
            <button className="btn-primary" onClick={() => void doMerge()}>Ajouter à mes données</button>
            <span className="settings-help">Garde ce qui est sur ce téléphone, ajoute ce qui manque et prend la version la plus récente de chaque élément.</span>
            {confirmReplace ? (
              <>
                <span className="settings-help warn">Tout ce qui est sur ce téléphone sera effacé et remplacé par cette sauvegarde.</span>
                <div className="confirm-row">
                  <button className="btn-outline" onClick={() => setConfirmReplace(false)}>Annuler</button>
                  <button className="btn-danger" onClick={() => void doReplace()}>Tout remplacer</button>
                </div>
              </>
            ) : (
              <button className="btn-outline danger" onClick={() => setConfirmReplace(true)}>Tout remplacer…</button>
            )}
            <button className="btn-link" onClick={() => { setPending(null); setConfirmReplace(false); }}>Ne pas importer</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Export pour un logiciel de musique ---------- */

function DawCard() {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const count = useMemo(() => listRecordings().length, []);
  const go = async () => {
    setMsg(null); setBusy('Préparation…');
    try {
      const r = await exportForDaw((d, t) => setBusy(`Conversion ${Math.min(d + 1, t)} / ${t}…`));
      if (!r.count) { setMsg({ text: 'Aucun enregistrement n’a pu être lu.', error: true }); return; }
      const how = await shareOrDownload(r.name, r.zip, 'Enregistrements RIFFBOX');
      if (how === 'cancelled') { setMsg({ text: 'Export annulé.' }); return; }
      setMsg({ text: `${plural(r.count, 'enregistrement', 'enregistrements')} ${how === 'shared' ? 'partagé' : 'téléchargé'}${r.count > 1 ? 's' : ''} en WAV (${fmtBytes(r.zip.size)}).`
        + (r.failed.length ? ` Illisible${r.failed.length > 1 ? 's' : ''} : ${r.failed.join(', ')}.` : '') });
    } catch {
      setMsg({ text: 'L’export a échoué. Réessayez.', error: true });
    } finally { setBusy(null); }
  };
  return (
    <div className="settings-card">
      <div className="settings-action">
        <span className="settings-label">Exporter pour un logiciel de musique</span>
        <span className="settings-help">
          Tous vos enregistrements (riffs, mémos, prises vocales) en WAV 24 bits 48 kHz, le format que lisent FL Studio,
          Reaper, Ableton Live, Logic ou Cubase. Le tempo et la tonalité sont dans le nom et dans le fichier
          (Ableton et FL Studio les lisent) ; un index les récapitule. Le tout dans un fichier .zip.
        </span>
        <button className="btn-primary" onClick={() => void go()} disabled={!!busy || !count}>
          {busy ?? (count ? `Exporter ${plural(count, 'enregistrement', 'enregistrements')} (.zip)` : 'Aucun enregistrement à exporter')}
        </button>
        {msg && <p className={'backup-msg' + (msg.error ? ' error' : '')} role="status">{msg.text}</p>}
      </div>
    </div>
  );
}
