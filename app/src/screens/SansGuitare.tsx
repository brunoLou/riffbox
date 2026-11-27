import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { OFF_KEY, OFF_SESSION, OFF_SESSION_MIN, offSeconds, type OffLog } from '../lib/offGuitar';
import { useStoredState } from '../lib/store';
import { markUsed } from '../lib/usage';
import './Theorie.css';

/** Pratiquer › Sans guitare: a ten-minute session of theory and ear training, counted as practice. */
export default function SansGuitare() {
  const nav = useNavigate();
  const [off] = useStoredState<OffLog>(OFF_KEY, {});
  useEffect(() => markUsed('sansguitare'), []);
  const total = offSeconds(off);
  const doneMin = Math.floor(total / 60);
  return (
    <Phone label="Sans guitare">
      <StatusBar />
      <div className="off-scroll">
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/pratiquer" />
            <div className="head-titles">
              <span className="kicker">Pratiquer</span>
              <h1 className="display" style={{ fontSize: 28 }}>SANS GUITARE</h1>
            </div>
          </div>
        </div>
        <p className="off-intro">Pas de guitare sous la main ? Dix minutes pour l’oreille et la théorie, au casque ou dans les transports. Ce temps compte dans vos jours de pratique.</p>

        <div className="card off-today">
          <div className="off-today-head">
            <span className="week-title">Séance du jour</span>
            <span className="off-today-min"><b>{Math.min(doneMin, 999)}</b>/{OFF_SESSION_MIN} min</span>
          </div>
          <div className="progress"><div style={{ width: `${Math.min(100, (total / 60 / OFF_SESSION_MIN) * 100)}%` }} /></div>
        </div>

        {OFF_SESSION.map((s, i) => {
          const sec = offSeconds(off, undefined, s.kind);
          const done = sec >= s.min * 60;
          return (
            <button key={s.kind} className={'off-step' + (done ? ' done' : '')} onClick={() => nav(s.to)}>
              <span className="off-step-dot">{done ? '✓' : i + 1}</span>
              <span className="off-step-text">
                <span className="off-step-name">{s.name}</span>
                <span className="off-step-detail">{s.detail}</span>
              </span>
              <span className="off-step-time mono">{Math.floor(sec / 60)}/{s.min} min</span>
              <span className="off-step-chev" aria-hidden>›</span>
            </button>
          );
        })}
        <p className="off-tip">Seul le temps passé à répondre compte : au-delà de 45 secondes sans réponse, le compteur attend la suivante.</p>
      </div>
      <TabBar active={2} />
    </Phone>
  );
}
