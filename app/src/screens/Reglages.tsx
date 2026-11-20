import { useEffect, useState } from 'react';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { blobsBytes, clearBlobs } from '../lib/blobs';
import { SETTINGS } from '../lib/data';
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
              <span className="display" style={{ fontSize: 30 }}>RÉGLAGES</span>
            </div>
          </div>
        </div>

        <span className="kicker settings-section">Affichage</span>
        <div className="settings-card">
          <button className="settings-row" onClick={() => setShowStreak(!showStreak)} aria-pressed={showStreak}>
            <span className="settings-label">Série de jours sur l’accueil</span>
            <span className={'switch' + (showStreak ? ' on' : '')}><span /></span>
          </button>
          <div className="settings-row col">
            <div className="settings-row-top">
              <span className="settings-label">Taille des paroles sur scène</span>
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

        <p className="settings-foot mono">RIFFBOX 0.1 · fonctionne hors ligne</p>
      </div>
      <TabBar active={0} />
    </Phone>
  );
}
