import type { Chord } from './music';

/** User settings (Réglages): storage keys and defaults. */
export const SETTINGS = {
  showStreak: { key: 'settings.showStreak', def: true },
  /** Prompteur lyric size in px (design range 20–40). */
  stageFontSize: { key: 'settings.stageFontSize', def: 26, min: 20, max: 40 },
};


export interface Tile {
  id: string; name: string; sub: string; bg: string; fg: string;
  /** LED lit: set on the home board when the tool was used today (lib/usage.ts). */
  on?: boolean; a: number; b: number; wide?: boolean; to: string;
  /** Only in the catalog, not on the default board. */
  extra?: boolean;
}

export const TILES: Tile[] = [
  { id: 'tuner', name: 'Accordeur', sub: 'Chromatique · Standard', bg: '#efe6d2', fg: '#1a1816', a: -40, b: 60, to: '/accordeur' },
  { id: 'metro', name: 'Métronome', sub: '92 BPM · 4/4', bg: '#e9a23b', fg: '#1a1816', a: 20, b: -70, to: '/metronome' },
  { id: 'carnet', name: 'Carnet', sub: '14 idées', bg: '#7a1f1f', fg: '#f6e7d8', a: 90, b: -10, to: '/composer' },
  { id: 'grilles', name: 'Grilles', sub: '3 grilles', bg: '#1f3350', fg: '#e8eef6', a: -100, b: 30, to: '/composer/grilles' },
  { id: 'backing', name: 'Backing tracks', sub: 'Blues en La · shuffle 90', bg: '#4a3020', fg: '#efe6d2', a: 45, b: -45, wide: true, to: '/pratiquer/backing' },
  { id: 'manche', name: 'Manche', sub: 'Penta mineure · La', bg: '#1f4a35', fg: '#e9f3ea', a: 0, b: 120, to: '/pratiquer/gammes' },
  { id: 'routine', name: 'Routine', sub: '25 min aujourd’hui', bg: '#3a3f47', fg: '#eef0f3', a: -60, b: 80, to: '/pratiquer' },
  { id: 'voix', name: 'Voix', sub: 'Justesse vocale', bg: '#4b2346', fg: '#f6e6f2', a: 70, b: -30, to: '/voix' },
  { id: 'capo', name: 'Capo', sub: 'Calculateur', bg: '#135e63', fg: '#e6f6f6', a: -20, b: 100, to: '/outils/capo' },
  { id: 'setlists', name: 'Setlists', sub: 'Bar du Port · 9 titres', bg: '#e2d6bd', fg: '#1a1816', a: 30, b: -120, wide: true, to: '/scene' },
  { id: 'accords', name: 'Accords', sub: '17 types · CAGED', bg: '#9c3d12', fg: '#fff1e6', a: 110, b: -60, to: '/pratiquer/accords', extra: true },
  { id: 'morceaux', name: 'Morceaux', sub: 'Paroles et accords', bg: '#c9a227', fg: '#1a1816', a: -80, b: 40, to: '/scene/morceaux', extra: true },
  { id: 'tonalite', name: 'Tonalité', sub: 'Trouver ma tonalité', bg: '#3b2e6e', fg: '#ece8fb', a: 15, b: 95, to: '/voix/tonalite', extra: true },
  { id: 'detect', name: 'Quel ton ?', sub: 'Tonalité à l’écoute', bg: '#24597f', fg: '#eef6fc', a: -35, b: 75, to: '/outils/ton', extra: true },
  { id: 'looper', name: 'Looper', sub: 'Boucles et couches', bg: '#161616', fg: '#f2f2f2', a: 60, b: -90, to: '/pratiquer/looper', extra: true },
  { id: 'relever', name: 'Relever', sub: 'Ralentir, boucler, transposer', bg: '#5c6b2e', fg: '#f3f6e6', a: -15, b: 70, to: '/pratiquer/relever', extra: true },
  { id: 'oreille', name: 'Oreille', sub: 'Intervalles et accords', bg: '#57406e', fg: '#f1eafb', a: 40, b: -30, to: '/pratiquer/oreille', extra: true },
  { id: 'coach', name: 'Coach', sub: 'Programme à mon niveau', bg: '#8a2a4a', fg: '#fdeef3', a: 25, b: 110, to: '/pratiquer/coach', extra: true },
  { id: 'reglages', name: 'Réglages', sub: 'Données et sauvegarde', bg: '#9aa0a8', fg: '#121315', a: -120, b: 10, to: '/reglages', extra: true },
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
