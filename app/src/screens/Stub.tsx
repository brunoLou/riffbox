import { useNavigate } from 'react-router-dom';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import './Stub.css';

export interface StubLink { title: string; sub: string; to: string }

/** Screens from the architecture wireframe that have no final design yet. */
export function Stub({ label, kicker, title, tab, back, links = [], note }: {
  label: string; kicker: string; title: string; tab: number; back?: string; links?: StubLink[]; note: string;
}) {
  const nav = useNavigate();
  return (
    <Phone label={label}>
      <StatusBar />
      <div className="screen-body" style={{ gap: 16 }}>
        <div className="head">
          <div className="head-l">
            {back && <BackButton fallback={back} />}
            <div className="head-titles">
              <span className="kicker">{kicker}</span>
              <span className="display" style={{ fontSize: 30, whiteSpace: 'nowrap' }}>{title}</span>
            </div>
          </div>
        </div>
        {links.map(l => (
          <button key={l.to} className="stub-link" onClick={() => nav(l.to)}>
            <span className="stub-link-title">{l.title}</span>
            <span className="stub-link-sub">{l.sub}</span>
            <span className="stub-link-arrow">›</span>
          </button>
        ))}
        <div className="stub-note"><span className="mono">À concevoir</span>{note}</div>
      </div>
      {tab >= 0 && <TabBar active={tab} />}
    </Phone>
  );
}

export const ComposerHome = () => (
  <Stub label="04 Carnet" kicker="Composer" title="CARNET D’IDÉES" tab={1}
    links={[{ title: 'Minuit Shuffle', sub: 'Grille · La · 92 BPM · shuffle', to: '/composer/grille' }]}
    note="Liste des fragments (riffs, grilles, paroles, mémos vocaux) avec filtres ton · tempo · style, et enregistrement en un tap." />
);

export const PratiquerHome = () => (
  <Stub label="07a Pratiquer" kicker="Pratiquer" title="PRATIQUER" tab={2}
    links={[
      { title: 'Gammes & accords', sub: 'Penta mineure · La', to: '/pratiquer/gammes' },
      { title: 'Backing tracks', sub: 'Blues en La · shuffle 90', to: '/pratiquer/backing' },
    ]}
    note="Routine du jour minutée (échauffement, technique, impro) et progression hebdomadaire." />
);

export const SceneHome = () => (
  <Stub label="08a Setlists" kicker="Scène" title="SETLISTS" tab={3}
    links={[{ title: 'Bar du Port', sub: '9 titres · 3. Minuit Shuffle', to: '/scene/prompteur' }]}
    note="Liste des setlists, détail d’un set avec titres réordonnables et « ▶ Jouer le set »." />
);

export const Metronome = () => (
  <Stub label="03 Métronome" kicker="Outil" title="MÉTRONOME" tab={0} back="/"
    note="Bouton rotatif BPM, tap tempo, signatures, subdivisions, accents et grooves blues shuffle, rock et funk." />
);

export const Backing = () => (
  <Stub label="07 Backing tracks" kicker="Pratiquer" title="BACKING TRACKS" tab={2} back="/pratiquer"
    note="Pistes par style et tonalité (ex. « Blues en La, 90 BPM, shuffle ») avec filtres et lecture." />
);

export const Idee = () => (
  <Stub label="FAB Capture" kicker="+ Idée" title="CAPTURE RAPIDE" tab={-1} back="/"
    links={[{ title: 'Ranger dans le carnet', sub: 'Composer · Carnet d’idées', to: '/composer' }]}
    note="Fiche qui monte du bas : « ● Enregistrer un riff », forme d’onde en direct et tags rapides." />
);
