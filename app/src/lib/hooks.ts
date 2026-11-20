import { INITIAL_GRIDS, type Grid } from './grids';
import { INITIAL_SETLISTS, INITIAL_SONGS, type Setlist, type Song } from './setlists';
import { useStoredState } from './store';

/** Shared, persisted collections. */
export const useSetlists = () => useStoredState<Setlist[]>('setlists', INITIAL_SETLISTS);
export const useGrids = () => useStoredState<Grid[]>('grids', INITIAL_GRIDS);
export const useSongs = () => useStoredState<Song[]>('songs', INITIAL_SONGS);
