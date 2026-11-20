import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import './fonts';
import './styles.css';
import Accueil from './screens/Accueil';
import Accordeur from './screens/Accordeur';
import Grille from './screens/Grille';
import Gammes from './screens/Gammes';
import Prompteur from './screens/Prompteur';
import Metronome from './screens/Metronome';
import Carnet from './screens/Carnet';
import { SetlistDetail, SetlistsScreen } from './screens/Setlists';
import { Backing, PratiquerHome } from './screens/Stub';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <div className="stage">
        <Routes>
          <Route path="/" element={<Accueil />} />
          <Route path="/accordeur" element={<Accordeur />} />
          <Route path="/metronome" element={<Metronome />} />
          <Route path="/idee" element={<Navigate to="/composer" replace state={{ record: true }} />} />
          <Route path="/composer" element={<Carnet />} />
          <Route path="/composer/grille" element={<Grille />} />
          <Route path="/pratiquer" element={<PratiquerHome />} />
          <Route path="/pratiquer/gammes" element={<Gammes />} />
          <Route path="/pratiquer/backing" element={<Backing />} />
          <Route path="/scene" element={<SetlistsScreen />} />
          <Route path="/scene/prompteur" element={<Navigate to="/scene/bar-du-port/play/2" replace />} />
          <Route path="/scene/:setId" element={<SetlistDetail />} />
          <Route path="/scene/:setId/play/:index" element={<Prompteur />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </HashRouter>
  </StrictMode>,
);
