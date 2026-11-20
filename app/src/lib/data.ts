import type { Chord } from './music';

/** User settings (Réglages): storage keys and defaults. */
export const SETTINGS = {
  showStreak: { key: 'settings.showStreak', def: true },
  /** Prompteur lyric size in px (design range 20–40). */
  stageFontSize: { key: 'settings.stageFontSize', def: 26, min: 20, max: 40 },
};

export const PRESETS = [
  { label: 'Standard', m: [40, 45, 50, 55, 59, 64] },
  { label: 'Drop D', m: [38, 45, 50, 55, 59, 64] },
  { label: 'Open G', m: [38, 43, 50, 55, 59, 62] },
  { label: 'Open E', m: [40, 47, 52, 56, 59, 64] },
  { label: '½ ton ↓', m: [39, 44, 49, 54, 58, 63] },
];

export interface Tile {
  id: string; name: string; sub: string; bg: string; fg: string;
  on?: boolean; a: number; b: number; wide?: boolean; to: string;
  /** Only in the catalog, not on the default board. */
  extra?: boolean;
}

export const TILES: Tile[] = [
  { id: 'tuner', name: 'Accordeur', sub: 'Chromatique · Standard', bg: '#efe6d2', fg: '#1a1816', on: true, a: -40, b: 60, to: '/accordeur' },
  { id: 'metro', name: 'Métronome', sub: '92 BPM · 4/4', bg: '#e9a23b', fg: '#1a1816', on: true, a: 20, b: -70, to: '/metronome' },
  { id: 'carnet', name: 'Carnet', sub: '14 idées', bg: '#2c2825', fg: '#efe6d2', a: 90, b: -10, to: '/composer' },
  { id: 'grilles', name: 'Grilles', sub: '3 grilles', bg: '#2c2825', fg: '#efe6d2', a: -100, b: 30, to: '/composer/grilles' },
  { id: 'backing', name: 'Backing tracks', sub: 'Blues en La · shuffle 90', bg: '#4a3020', fg: '#efe6d2', on: true, a: 45, b: -45, wide: true, to: '/pratiquer/backing' },
  { id: 'manche', name: 'Manche', sub: 'Penta mineure · La', bg: '#2c2825', fg: '#efe6d2', a: 0, b: 120, to: '/pratiquer/gammes' },
  { id: 'routine', name: 'Routine', sub: '25 min aujourd’hui', bg: '#2c2825', fg: '#efe6d2', a: -60, b: 80, to: '/pratiquer' },
  { id: 'voix', name: 'Voix', sub: 'Justesse vocale', bg: '#2c2825', fg: '#efe6d2', a: 70, b: -30, to: '/voix' },
  { id: 'capo', name: 'Capo', sub: 'Calculateur', bg: '#2c2825', fg: '#efe6d2', a: -20, b: 100, to: '/outils/capo' },
  { id: 'setlists', name: 'Setlists', sub: 'Bar du Port · 9 titres', bg: '#efe6d2', fg: '#1a1816', a: 30, b: -120, wide: true, to: '/scene' },
  { id: 'accords', name: 'Accords', sub: '17 types · CAGED', bg: '#2c2825', fg: '#efe6d2', a: 110, b: -60, to: '/pratiquer/accords', extra: true },
  { id: 'morceaux', name: 'Morceaux', sub: 'Paroles et accords', bg: '#4a3020', fg: '#efe6d2', on: true, a: -80, b: 40, to: '/scene/morceaux', extra: true },
  { id: 'tonalite', name: 'Tonalité', sub: 'Trouver ma tonalité', bg: '#2c2825', fg: '#efe6d2', a: 15, b: 95, to: '/voix/tonalite', extra: true },
  { id: 'reglages', name: 'Réglages', sub: 'Données et sauvegarde', bg: '#2c2825', fg: '#efe6d2', a: -120, b: 10, to: '/reglages', extra: true },
];

/** A tile on the home board: which one, and whether it spans both columns. */
export interface Slot { id: string; wide: boolean }
export const DEFAULT_LAYOUT: Slot[] = TILES.filter(t => !t.extra).map(t => ({ id: t.id, wide: !!t.wide }));

/** Placeholder lyrics written for the mock-up. */
export const SONG = `{c:Couplet 1}
[A7]J'ai pris la route [D7]avant le jour
[A7]Le moteur tousse, la radio [A7]grésille
[D7]Trois cents bornes pour [A7]un seul retour
[E7]Le vent me pousse, [D7]la nuit [A7]brille [E7]
{c:Refrain}
[A7]Minuit shuffle, [D7]minuit shuffle
[A7]Les néons tremblent au [A7]bord du quai
[D7]Minuit shuffle, je [A7]tape du pied
[E7]Jusqu'à l'aube [D7]on va [A7]jouer [E7]
{c:Couplet 2}
[A7]La salle est pleine, [D7]la bière est tiède
[A7]Le batteur compte, un, [A7]deux, trois
[D7]Ma vieille caisse a [A7]le son qui m'aide
[E7]Six cordes [D7]et rien que [A7]ça [E7]
{c:Pont}
[F#m]On ralentit, [D]on respire
[F#m]La basse tourne, [E7]laisse venir
{c:Refrain}
[A7]Minuit shuffle, [D7]minuit shuffle
[A7]Les néons tremblent au [A7]bord du quai
[D7]Minuit shuffle, je [A7]tape du pied
[E7]Jusqu'à l'aube [D7]on va [A7]jouer [E7]`;

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const GRID_INITIAL: Chord[][] = [
  [{ pc: 9 }, { pc: 2 }, { pc: 9 }, { pc: 4 }],
  [{ pc: 2 }, { pc: 9 }, { pc: 4 }, { pc: 9 }],
  [{ pc: 6, m: true }, { pc: 2 }, { pc: 11, m: true }, { pc: 4 }],
];
