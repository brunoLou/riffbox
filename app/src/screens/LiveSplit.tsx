import { useParams } from 'react-router-dom';
import { PaneEmpty, SplitView, useWideDesktop } from '../components/Chrome';
import { MorceauRoute, MorceauxScreen } from './Morceaux';
import { SetlistDetail, SetlistsScreen } from './Setlists';

/**
 * Live on a computer's wide window: the list on the left, the song or the setlist on the right,
 * without leaving the list. One component for both routes, so the list keeps its state (search…).
 */
export function SongsPage() {
  const wide = useWideDesktop();
  const { songId } = useParams();
  if (!wide) return songId ? <MorceauRoute /> : <MorceauxScreen />;
  return <SplitView label="Morceaux" tab={3} left={<MorceauxScreen />}
    right={songId ? <MorceauRoute /> : <PaneEmpty text="Choisissez un morceau à gauche, ou créez-en un : il s’ouvre ici." />} />;
}

export function SetsPage() {
  const wide = useWideDesktop();
  const { setId } = useParams();
  if (!wide) return setId ? <SetlistDetail /> : <SetlistsScreen />;
  return <SplitView label="Setlists" tab={3} left={<SetlistsScreen />}
    right={setId ? <SetlistDetail key={setId} /> : <PaneEmpty text="Choisissez une setlist à gauche : sa fiche de concert s’ouvre ici." />} />;
}
