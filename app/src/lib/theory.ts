/**
 * Theory without a guitar: chord shapes, the notes of a chord, relative keys, degrees, capo and
 * keys of a chord progression. Notes are spelled properly (Si♭ in Fa majeur, not La♯), from the
 * letter of each degree. Pure: questions, answers and scores.
 */
import { chordType, type ChordType } from './chords';
import { mod12 } from './music';

export type TheoryKind = 'diagram' | 'notes' | 'relative' | 'degree' | 'capo' | 'key';
export type TheoryLevel = 1 | 2 | 3;
export const THEORY_LEVEL_FR: Record<TheoryLevel, string> = { 1: 'Débutant', 2: 'Intermédiaire', 3: 'Avancé' };
export const THEORY_KIND_FR: Record<TheoryKind, string> = {
  diagram: 'Diagrammes d’accords', notes: 'Notes des accords', relative: 'Relatifs majeur / mineur',
  degree: 'Degrés d’une tonalité', capo: 'Capodastre', key: 'Tonalité d’une suite',
};
const LEVEL_KINDS: Record<TheoryLevel, TheoryKind[]> = {
  1: ['diagram', 'notes', 'relative'],
  2: ['diagram', 'notes', 'relative', 'degree', 'capo'],
  3: ['diagram', 'notes', 'relative', 'degree', 'capo', 'key'],
};
export const levelKinds = (lv: TheoryLevel) => LEVEL_KINDS[lv];

/* ---------- Spelling ---------- */

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const LETTER_FR: Record<string, string> = { C: 'Do', D: 'Ré', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };

/** A spelled note: its letter (0 = C … 6 = B) and its pitch class. */
export interface Spelled { letter: number; pc: number }
/** « Bb », « F# », « C » (ASCII, as chord charts are written). */
export function noteName(n: Spelled): string {
  const d = ((n.pc - LETTER_PC[n.letter] + 18) % 12) - 6; // -2 … +2
  return LETTERS[n.letter] + (d > 0 ? '#'.repeat(d) : 'b'.repeat(-d));
}
/** « Si♭ », « Fa♯ ». */
export function noteFr(n: Spelled): string {
  const s = noteName(n);
  return LETTER_FR[s[0]] + s.slice(1).replace(/#/g, '♯').replace(/b/g, '♭');
}
/** The note `semis` above `from`, written `steps` letters higher (a third: 2 letters). */
export const above = (from: Spelled, semis: number, steps: number): Spelled => ({ letter: (from.letter + steps) % 7, pc: mod12(from.pc + semis) });
export function parseNote(s: string): Spelled | null {
  const m = s.match(/^([A-G])([#b♯♭]*)$/);
  if (!m) return null;
  const letter = LETTERS.indexOf(m[1]);
  const acc = [...m[2]].reduce((t, c) => t + (c === '#' || c === '♯' ? 1 : -1), 0);
  return { letter, pc: mod12(LETTER_PC[letter] + acc) };
}

/** Major keys and how their tonic is written (flats for Fa, Si♭, Mi♭, La♭, Ré♭). */
const KEY_SPELL: Record<number, string> = { 0: 'C', 1: 'Db', 2: 'D', 3: 'Eb', 4: 'E', 5: 'F', 6: 'F#', 7: 'G', 8: 'Ab', 9: 'A', 10: 'Bb', 11: 'B' };
export const keyTonic = (pc: number) => parseNote(KEY_SPELL[mod12(pc)])!;
/** Minor keys: the tonic written as in their relative major (Ré mineur, Fa♯ mineur, Do mineur…). */
const MINOR_SPELL: Record<number, string> = { 0: 'C', 1: 'C#', 2: 'D', 3: 'Eb', 4: 'E', 5: 'F', 6: 'F#', 7: 'G', 8: 'G#', 9: 'A', 10: 'Bb', 11: 'B' };
export const minorTonic = (pc: number) => parseNote(MINOR_SPELL[mod12(pc)])!;

/** A chord: its root as written and its type. */
export interface TChord { root: Spelled; type: ChordType }
const TYPE_SYM: Record<string, string> = { maj: '', m: 'm', '7': '7', maj7: 'maj7', m7: 'm7', dim: 'dim' };
/** « Bbm », « F#7 » (ASCII, readable by the chord tools). */
export const chordSym = (c: TChord) => noteName(c.root) + (TYPE_SYM[c.type.id] ?? c.type.sym);
/** « B♭m » for display. */
export const chordShow = (c: TChord) => { const s = chordSym(c); return s[0] + s.slice(1).replace(/^b/, '♭').replace(/#/g, '♯'); };
/** « Si♭ mineur ». */
export const chordFrName = (c: TChord) => `${noteFr(c.root)} ${c.type.fr}`;
/** The notes of a chord, spelled from its root (the 3rd is two letters up, the 5th four…). */
export function chordNotes(c: TChord): Spelled[] {
  return c.type.ivs.map(([semis, deg]) => above(c.root, semis, Number(String(deg).replace(/[^\d]/g, '')) - 1));
}
const mk = (root: Spelled, id: string): TChord => ({ root, type: chordType(id) });
export const parseTChord = (s: string): TChord | null => {
  const m = s.match(/^([A-G][#b]?)(.*)$/);
  const root = m && parseNote(m[1]);
  const id = m ? Object.entries(TYPE_SYM).find(([, sym]) => sym === m[2])?.[0] : undefined;
  return root && id ? mk(root, id) : null;
};

/** The chords of a major key on degrees I to vi (the vii° is left out: rare on the guitar). */
const DEGREES: { roman: string; semis: number; minor: boolean }[] = [
  { roman: 'I', semis: 0, minor: false }, { roman: 'ii', semis: 2, minor: true }, { roman: 'iii', semis: 4, minor: true },
  { roman: 'IV', semis: 5, minor: false }, { roman: 'V', semis: 7, minor: false }, { roman: 'vi', semis: 9, minor: true },
];
export function diatonic(key: number): (TChord & { roman: string })[] {
  const t = keyTonic(key);
  return DEGREES.map((d, i) => ({ ...mk(above(t, d.semis, i), d.minor ? 'm' : 'maj'), roman: d.roman }));
}
export const keyFr = (key: number) => `${noteFr(keyTonic(key))} majeur`;

/* ---------- Questions ---------- */

/** Chords asked about, by level (as written on chord charts). */
const POOLS: Record<TheoryLevel, string[]> = {
  1: ['C', 'D', 'E', 'G', 'A', 'Am', 'Em', 'Dm'],
  2: ['C', 'D', 'E', 'F', 'G', 'A', 'Am', 'Em', 'Dm', 'Bm', 'A7', 'D7', 'E7', 'G7', 'B7'],
  3: ['C', 'D', 'E', 'F', 'G', 'A', 'Bb', 'Am', 'Em', 'Dm', 'Bm', 'F#m', 'Cm', 'Gm', 'C#m', 'E7', 'B7', 'Cmaj7', 'Fmaj7', 'Am7', 'Dm7', 'Em7'],
};
const KEYS: Record<TheoryLevel, number[]> = { 1: [0, 7, 2, 9, 4], 2: [0, 7, 2, 9, 4, 5], 3: [0, 7, 2, 9, 4, 11, 5, 10, 3, 8] };
const CAPO_SHAPES: Record<TheoryLevel, string[]> = { 1: ['C', 'G', 'D', 'A', 'E'], 2: ['C', 'G', 'D', 'A', 'E', 'Am', 'Em'], 3: ['C', 'G', 'D', 'A', 'E', 'Am', 'Em', 'Dm'] };

export interface TheoryQuestion {
  kind: TheoryKind;
  prompt: string;
  /** Diagram questions: the chord whose shape is drawn. */
  diagram?: string;
  /** Key questions: the progression shown. */
  chords?: string[];
  answer: string;
  choices: string[];
  /** Shown after the answer. */
  explain: string;
}

type Rng = () => number;
const pick = <T,>(xs: T[], rnd: Rng) => xs[Math.floor(rnd() * xs.length) % xs.length];
function shuffle<T>(xs: T[], rnd: Rng): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** Four distinct choices: the answer and three others, in random order. */
function choicesOf(answer: string, others: string[], rnd: Rng): string[] {
  const out = [answer];
  for (const o of shuffle(others, rnd)) if (!out.includes(o) && out.length < 4) out.push(o);
  return shuffle(out, rnd);
}
const notesText = (c: TChord) => chordNotes(c).map(noteFr).join(' – ');
const label = (c: TChord) => `${chordFrName(c)} (${chordShow(c)})`;

export function makeTheoryQuestion(lv: TheoryLevel, rnd: Rng = Math.random, kind?: TheoryKind, avoid?: string): TheoryQuestion {
  const k = kind ?? pick(LEVEL_KINDS[lv], rnd);
  const pool = POOLS[lv];
  let sym = pick(pool, rnd);
  if (sym === avoid) sym = pool[(pool.indexOf(sym) + 1) % pool.length];
  const c = parseTChord(sym)!;

  if (k === 'diagram') {
    // Look-alikes first: same root, or same type.
    const near = pool.filter(s => s !== sym && (s[0] === sym[0] || parseTChord(s)!.type.id === c.type.id));
    const others = [...near, ...pool.filter(s => s !== sym)].map(s => label(parseTChord(s)!));
    return { kind: k, prompt: 'Quel est cet accord ?', diagram: sym, answer: label(c), choices: choicesOf(label(c), others.slice(0, 6), rnd), explain: `${label(c)} : ${notesText(c)}.` };
  }
  if (k === 'notes') {
    // Wrong answers: the other quality on the same root, the same chord a tone away, a wrong fifth.
    const twin = mk(c.root, c.type.id === 'm' ? 'maj' : c.type.id === 'maj' ? 'm' : c.type.id === '7' ? 'maj7' : 'm');
    const up = mk(above(c.root, 2, 1), c.type.id), down = mk(above(c.root, -2, 6), c.type.id);
    const notes = chordNotes(c);
    const sharp5 = notes.map((n, i) => (i === 2 ? { ...n, pc: mod12(n.pc + 1) } : n)).map(noteFr).join(' – ');
    return {
      kind: k, prompt: `Quelles notes forment ${label(c)} ?`, answer: notesText(c),
      choices: choicesOf(notesText(c), [notesText(twin), notesText(up), notesText(down), sharp5], rnd),
      explain: `${chordFrName(c)} : ${notesText(c)}. Fondamentale, tierce ${c.type.ivs.some(([semis]) => semis === 3) ? 'mineure' : 'majeure'}, quinte${c.type.ivs.length > 3 ? ', septième' : ''}.`,
    };
  }
  if (k === 'relative') {
    const key = pick(KEYS[lv], rnd);
    const major = keyTonic(key), minor = above(major, 9, 5);
    const toMinor = rnd() < 0.6;
    const nm = (n: Spelled, m: boolean) => `${noteFr(n)} ${m ? 'mineur' : 'majeur'}`;
    if (toMinor) {
      const wrong = [above(major, 4, 2), above(major, 2, 1), above(major, 5, 3), above(major, 7, 4)].map(n => nm(n, true));
      return { kind: k, prompt: `Quel est le relatif mineur de ${nm(major, false)} ?`, answer: nm(minor, true), choices: choicesOf(nm(minor, true), wrong, rnd),
        explain: `Le relatif mineur est une tierce mineure (3 demi-tons) plus bas : ${nm(major, false)} → ${nm(minor, true)}. Mêmes notes, même armure.` };
    }
    const wrong = [above(minor, 7, 4), above(minor, 5, 3), above(minor, 10, 6), above(minor, 4, 2)].map(n => nm(n, false));
    return { kind: k, prompt: `Quel est le relatif majeur de ${nm(minor, true)} ?`, answer: nm(major, false), choices: choicesOf(nm(major, false), wrong, rnd),
      explain: `Le relatif majeur est une tierce mineure (3 demi-tons) plus haut : ${nm(minor, true)} → ${nm(major, false)}.` };
  }
  if (k === 'degree') {
    const key = pick(KEYS[lv], rnd);
    const chords = diatonic(key);
    const d = pick([1, 2, 3, 4, 5], rnd); // ii to vi (the I is too easy)
    const target = chords[d];
    return {
      kind: k, prompt: `En ${keyFr(key)}, quel est l’accord ${target.roman} ?`, answer: label(target),
      choices: choicesOf(label(target), chords.filter((_, i) => i !== d).map(label), rnd),
      explain: `${keyFr(key)} : ${chords.map(x => `${x.roman} ${chordShow(x)}`).join(' · ')}.`,
    };
  }
  if (k === 'capo') {
    const shape = parseTChord(pick(CAPO_SHAPES[lv], rnd))!;
    const fret = 1 + Math.floor(rnd() * (lv === 1 ? 3 : 5));
    // The sounding chord, spelled as usual for its key.
    const pc = mod12(shape.root.pc + fret);
    const sound = mk(shape.type.id === 'm' ? minorTonic(pc) : keyTonic(pc), shape.type.id);
    const near = (n: number) => mk(shape.type.id === 'm' ? minorTonic(shape.root.pc + n) : keyTonic(shape.root.pc + n), shape.type.id);
    return {
      kind: k, prompt: `Capodastre en case ${fret}, vous jouez une forme de ${chordFrName(shape)} (${chordShow(shape)}) : quel accord entend-on ?`,
      answer: label(sound), choices: choicesOf(label(sound), [label(shape), label(near(fret + 1)), label(near(fret - 1)), label(near(-fret))], rnd),
      explain: `Chaque case monte d’un demi-ton : ${chordShow(shape)} + ${fret} demi-ton${fret > 1 ? 's' : ''} = ${chordShow(sound)}.`,
    };
  }
  // key: I, IV and V (only one major key has these three) plus one of ii, iii, vi.
  const key = pick(KEYS[lv], rnd);
  const ch = diatonic(key);
  const prog = shuffle([ch[0], ch[3], ch[4], ch[pick([1, 2, 5], rnd)]], rnd);
  const wrong = [5, 7, 2, 10].map(n => keyFr(key + n));
  return {
    kind: k, prompt: 'Dans quelle tonalité est cette suite d’accords ?', chords: prog.map(chordShow), answer: keyFr(key),
    choices: choicesOf(keyFr(key), wrong, rnd),
    explain: `Les trois accords majeurs ${chordShow(ch[0])}, ${chordShow(ch[3])} et ${chordShow(ch[4])} sont les degrés I, IV et V de ${keyFr(key)}.`,
  };
}

/** Scores per kind: right / asked. */
export type TheoryStats = Partial<Record<TheoryKind, { ok: number; n: number }>>;
export const THEORY_STATS_KEY = 'theory.stats';
export function recordTheory(stats: TheoryStats, kind: TheoryKind, ok: boolean): TheoryStats {
  const cur = stats[kind] ?? { ok: 0, n: 0 };
  return { ...stats, [kind]: { ok: cur.ok + (ok ? 1 : 0), n: cur.n + 1 } };
}
export function theorySummary(stats: TheoryStats) {
  const rows = Object.entries(stats) as [TheoryKind, { ok: number; n: number }][];
  const n = rows.reduce((t, [, x]) => t + x.n, 0), ok = rows.reduce((t, [, x]) => t + x.ok, 0);
  const weakest = rows.filter(([, x]) => x.n >= 3).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n)[0];
  return { n, rate: n ? Math.round((ok / n) * 100) : null, weakest: weakest && weakest[1].ok / weakest[1].n < 0.8 ? weakest[0] : null };
}
