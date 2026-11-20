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

export const PratiquerHome = () => (
  <Stub label="07a Pratiquer" kicker="Pratiquer" title="PRATIQUER" tab={2}
    links={[
      { title: 'Gammes & accords', sub: 'Penta mineure · La', to: '/pratiquer/gammes' },
      { title: 'Backing tracks', sub: 'Blues en La · shuffle 90', to: '/pratiquer/backing' },
    ]}
    note="Routine du jour minutée (échauffement, technique, impro) et progression hebdomadaire." />
);

export const Backing = () => (
  <Stub label="07 Backing tracks" kicker="Pratiquer" title="BACKING TRACKS" tab={2} back="/pratiquer"
    note="Pistes par style et tonalité (ex. « Blues en La, 90 BPM, shuffle ») avec filtres et lecture." />
);
