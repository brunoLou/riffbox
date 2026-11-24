import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import './fonts';
import './styles.css';
import { requestPersistence } from './lib/store';
import { installSync } from './lib/sync';
import { initTheme } from './lib/theme';
import Accueil from './screens/Accueil';
import Accordeur from './screens/Accordeur';
import Grille from './screens/Grille';
import Gammes from './screens/Gammes';
import Prompteur from './screens/Prompteur';
import Metronome from './screens/Metronome';
import Carnet from './screens/Carnet';
import { SetlistDetail, SetlistsScreen } from './screens/Setlists';
import { MorceauRoute, MorceauxScreen } from './screens/Morceaux';
import Voix, { VoixListe, VoixPrises } from './screens/Voix';
import { VoixExercice, VoixPrise } from './screens/VoixSession';
import { Tessiture, Tonalite } from './screens/VoixTessiture';
import Capo from './screens/Capo';
import Accords from './screens/Accords';
import Pratiquer from './screens/Pratiquer';
import Routine from './screens/Routine';
import RoutineEdit from './screens/RoutineEdit';
import DesignSystem from './screens/DesignSystem';
import DetecteurTon from './screens/DetecteurTon';
import Looper from './screens/Looper';
import Relever from './screens/Relever';
import Coach from './screens/Coach';
import { FileDrop } from './components/FileDrop';
import { installAutoSync } from './lib/autoSync';
import { consumeShare } from './lib/shared';
import Backing from './screens/Backing';
import Reglages from './screens/Reglages';

consumeShare(); // before the router reads the address
installSync();
installAutoSync();
requestPersistence();
initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <FileDrop />
      <div className="stage">
        <Routes>
          <Route path="/" element={<Accueil />} />
          <Route path="/accordeur" element={<Accordeur />} />
          <Route path="/metronome" element={<Metronome />} />
          <Route path="/reglages" element={<Reglages />} />
          <Route path="/reglages/design" element={<DesignSystem />} />
          <Route path="/idee" element={<Navigate to="/composer" replace state={{ record: true }} />} />
          <Route path="/composer" element={<Carnet />} />
          <Route path="/composer/grilles" element={<Carnet initialKind="grille" />} />
          <Route path="/composer/grille" element={<Grille />} />
          <Route path="/composer/grille/:gridId" element={<Grille />} />
          <Route path="/pratiquer" element={<Pratiquer />} />
          <Route path="/pratiquer/routine" element={<Routine />} />
          <Route path="/pratiquer/routine/modifier" element={<RoutineEdit />} />
          <Route path="/pratiquer/gammes" element={<Gammes />} />
          <Route path="/pratiquer/backing" element={<Backing />} />
          <Route path="/pratiquer/accords" element={<Accords />} />
          <Route path="/voix" element={<Voix />} />
          <Route path="/voix/exercices" element={<VoixListe kind="warmup" />} />
          <Route path="/voix/melodies" element={<VoixListe kind="melody" />} />
          <Route path="/voix/ex/:pieceId" element={<VoixExercice />} />
          <Route path="/voix/prises" element={<VoixPrises />} />
          <Route path="/voix/prise/:takeId" element={<VoixPrise />} />
          <Route path="/voix/tessiture" element={<Tessiture />} />
          <Route path="/voix/tonalite" element={<Tonalite />} />
          <Route path="/outils/capo" element={<Capo />} />
          <Route path="/outils/ton" element={<DetecteurTon />} />
          <Route path="/pratiquer/looper" element={<Looper />} />
          <Route path="/pratiquer/relever" element={<Relever />} />
          <Route path="/pratiquer/coach" element={<Coach />} />
          <Route path="/scene" element={<SetlistsScreen />} />
          <Route path="/scene/morceaux" element={<MorceauxScreen />} />
          <Route path="/scene/morceau/:songId" element={<MorceauRoute />} />
          <Route path="/scene/prompteur" element={<Navigate to="/scene/bar-du-port/play/2" replace />} />
          <Route path="/scene/:setId" element={<SetlistDetail />} />
          <Route path="/scene/:setId/play/:index" element={<Prompteur />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </HashRouter>
  </StrictMode>,
);
