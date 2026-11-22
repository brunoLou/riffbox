/**
 * « Idées pour la suite »: chords that can follow the last one of a grid section, from common
 * harmony. Pure logic: the key is the grid's major key, chords are grid chords.
 */
import { chordName, mod12, sameChord, type Chord } from './music';

export type SuggestFamily = 'natural' | 'color' | 'end';
export interface Suggestion {
  /** Chords to add, in order (cadences add two). */
  chords: Chord[];
  /** Degree label, e.g. "IV", "♭VII", "V7 → I". */
  label: string;
  /** Why it works, in a few words. */
  why: string;
}
export const FAMILY_FR: Record<SuggestFamily, string> = { natural: 'Naturels', color: 'Couleurs', end: 'Pour finir' };

const ROMAN = ['I', '♭II', 'II', '♭III', 'III', 'IV', '♯IV', 'V', '♭VI', 'VI', '♭VII', 'VII'];
/** Degree of a chord in the major key: "IV", "vi", "♭VII", "V7", "Vsus4"… */
export function romanOf(key: number, c: Chord): string {
  const r = ROMAN[mod12(c.pc - key)];
  if (c.x === 'sus4') return r + 'sus4';
  return (c.m ? r.toLowerCase() : r) + (c.x === '7' ? '7' : '');
}

const at = (key: number, d: number, m = false, x?: Chord['x']): Chord => ({ pc: mod12(key + d), ...(m ? { m } : {}), ...(x ? { x } : {}) });

type Step = [deg: number, minor: boolean, why: string];
/** What usually follows each diatonic chord (most common first). */
const NEXT: Record<string, Step[]> = {
  start: [[0, false, 'partir de la tonique'], [9, true, 'partir en mineur'], [5, false, 'partir en suspens'], [2, true, 'partir en douceur']],
  '0': [[5, false, 's’éloigner en douceur'], [7, false, 'monter la tension'], [9, true, 'vers le relatif mineur'], [2, true, 'départ en douceur']],
  '2m': [[7, false, 'prépare le retour (ii → V)'], [5, false, 'reste en suspens'], [0, false, 'retour direct'], [4, true, 'descente douce']],
  '4m': [[9, true, 'enchaînement naturel'], [5, false, 'ouvre la phrase'], [2, true, 'descente douce'], [0, false, 'retour']],
  '5': [[7, false, 'monte vers la dominante'], [0, false, 'retour à la maison, en douceur'], [2, true, 'reste dans le flou'], [9, true, 'assombrit']],
  '7': [[0, false, 'retour à la maison'], [9, true, 'cadence trompeuse'], [5, false, 'on redescend (rock)'], [4, true, 'surprise douce']],
  '9m': [[5, false, 'le grand classique vi → IV'], [2, true, 'descente en quintes'], [7, false, 'repart vers la dominante'], [4, true, 'reste dans l’ombre']],
  // Borrowed chords and their usual way back.
  '10': [[0, false, 'retour à la maison (rock)'], [5, false, 'redescend vers le IV']],
  '8': [[10, false, 'montée épique ♭VI → ♭VII'], [0, false, 'retour lumineux']],
  '5m': [[0, false, 'résolution nostalgique'], [7, false, 'repart vers la dominante']],
  '2': [[7, false, 'vers la dominante']],
};

function natural(key: number, last: Chord | undefined): Suggestion[] {
  const out: Suggestion[] = [];
  const push = (c: Chord, why: string) => {
    if (last && sameChord(c, last)) return;
    if (out.some(s => sameChord(s.chords[0], c))) return;
    out.push({ chords: [c], label: romanOf(key, c), why });
  };
  if (!last) { NEXT.start.forEach(([d, m, why]) => push(at(key, d, m), why)); return out; }
  // A suspension resolves on its own chord; a dominant seventh resolves a fourth up.
  if (last.x === 'sus4') push({ pc: last.pc }, 'résout la suspension');
  if (last.x === '7' && !last.m) {
    const target = mod12(last.pc + 5);
    const t = [0, 5, 7].includes(mod12(target - key)) ? { pc: target } : [2, 4, 9].includes(mod12(target - key)) ? { pc: target, m: true } : null;
    if (t) push(t, 'la résolution attendue');
  }
  const d = mod12(last.pc - key);
  const steps = NEXT[`${d}${last.m ? 'm' : ''}`] ?? [[0, false, 'retour à la tonique'], [5, false, 'vers le IV'], [7, false, 'vers le V']];
  steps.forEach(([deg, m, why]) => push(at(key, deg, m), why));
  return out.slice(0, 4);
}

interface Colour { c: Chord; label: string; why: string; after: string[] }
function colours(key: number, last: Chord | undefined, taken: Suggestion[]): Suggestion[] {
  const vi = at(key, 9, true), ii = at(key, 2, true), IV = at(key, 5), V = at(key, 7);
  const list: Colour[] = [
    { c: at(key, 5, true), label: 'iv', why: 'IV mineur : nostalgie', after: ['5', '0'] },
    { c: at(key, 10), label: '♭VII', why: 'couleur rock', after: ['0', 'start', '5'] },
    { c: at(key, 8), label: '♭VI', why: 'emprunt épique au mineur', after: ['9m', 'start', '5m'] },
    { c: at(key, 4, false, '7'), label: 'V7/vi', why: `tire vers ${chordName(vi)}`, after: ['0', '5', '4m'] },
    { c: at(key, 9, false, '7'), label: 'V7/ii', why: `tire vers ${chordName(ii)}`, after: ['9m', '0', '4m'] },
    { c: at(key, 0, false, '7'), label: 'I7', why: `tire vers ${chordName(IV)} (blues)`, after: ['0', '7'] },
    { c: at(key, 2), label: 'II', why: `dominante de ${chordName(V)}`, after: ['0', '5', '2m'] },
    { c: at(key, 7, false, 'sus4'), label: 'Vsus4', why: 'suspension avant la résolution', after: ['5', '2m', '0'] },
    { c: at(key, 7, false, '7'), label: 'V7', why: 'plus de tension que le V', after: ['2m', '5', '0'] },
  ];
  const ctx = last ? `${mod12(last.pc - key)}${last.m ? 'm' : ''}` : 'start';
  return list
    .map((x, i) => ({ x, score: (x.after.indexOf(ctx) >= 0 ? 10 - x.after.indexOf(ctx) * 2 : 0) - i * 0.1 }))
    .filter(({ x }) => !(last && sameChord(x.c, last)) && !taken.some(s => sameChord(s.chords[0], x.c)))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ x }) => ({ chords: [x.c], label: x.label, why: x.why }));
}

function endings(key: number, last: Chord | undefined): Suggestion[] {
  const I = at(key, 0);
  const list: Suggestion[] = [
    { chords: [at(key, 7, false, '7'), I], label: 'V7 → I', why: 'cadence parfaite : la fin la plus nette' },
    { chords: [at(key, 5), I], label: 'IV → I', why: 'cadence plagale : fin douce, « amen »' },
    { chords: [at(key, 5, true), I], label: 'iv → I', why: 'fin nostalgique, au IV mineur' },
    { chords: [at(key, 10), I], label: '♭VII → I', why: 'fin rock' },
    { chords: [at(key, 7, false, 'sus4'), at(key, 7)], label: 'Vsus4 → V', why: 'reste ouvert : enchaîne sur la section suivante' },
  ];
  // Already on the first chord of a cadence: only what is left of it is added.
  return list.map(s => (last && s.chords[0].pc === last.pc && !!s.chords[0].m === !!last.m && s.chords.length > 1
    ? { ...s, chords: s.chords.slice(1) } : s));
}

/** Suggestions to add after the section's chords `before` in the major key `key`. */
export function suggest(key: number, before: Chord[]): Record<SuggestFamily, Suggestion[]> {
  const last = before[before.length - 1];
  const nat = natural(key, last);
  return { natural: nat, color: colours(key, last, nat), end: endings(key, last) };
}

