/** The live line under a pedal's name (the same on the home board, in Pratiquer and in the catalog). */
import type { Tile } from './data';
import { readGrids } from './grids';
import { KEY_FR } from './music';
import { scaleDef } from './scales';
import { INITIAL_IDEAS } from './ideas';
import { doneSeconds, type RoutineState, routineMin } from './routine';
import { INITIAL_SETLISTS, nextSet, readSongs, titlesLabel } from './setlists';
import { readStored } from './store';
import { currentTuning } from './tunings';
import { readRange, noteFr } from './voice';

export function subFor(t: Tile, r: RoutineState): string {
  const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? 's' : ''}`;
  switch (t.id) {
    case 'tuner': return `Chromatique · ${currentTuning().label}`;
    case 'metro': return `${readStored('metro.bpm', 92)} BPM · ${readStored('metro.sig', '4/4')}`;
    case 'carnet': return plural(readStored('ideas', INITIAL_IDEAS).length + readGrids().length, 'idée');
    case 'grilles': return plural(readGrids().length, 'grille');
    case 'manche': return `${scaleDef(readStored('scale.id', readStored('scale.maj', false) ? 'pmaj' : 'pmin')).chip} · ${KEY_FR[readStored('scale.key', 9)]}`;
    case 'routine': return `${Math.floor(doneSeconds(r) / 60)}/${routineMin()} min aujourd’hui`;
    case 'morceaux': return plural(readSongs().length, 'titre');
    case 'tonalite': { const v = readRange(); return v.measured ? `${noteFr(v.low)} – ${noteFr(v.high)}` : t.sub; }
    case 'setlists': {
      const next = nextSet(readStored('setlists', INITIAL_SETLISTS));
      return next ? `${next.name} · ${titlesLabel(next.songIds.length)}` : 'Aucun concert prévu';
    }
  }
  return t.sub;
}
