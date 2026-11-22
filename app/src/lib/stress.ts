/**
 * « Temps forts »: where the stress falls in a French lyric line, and chords that sit on a weak
 * syllable. French stresses the last pronounced syllable of a word group: at the end of the line
 * or before punctuation (strongest), and at the end of each full word; mute e and little grammar
 * words are never stressed. A chord change sounds right on a stressed syllable (the strong beat).
 */
import { ENT_HEARD } from './lyrics';

const VOWELS = 'aàâäeéèêëiîïoôöuùûüyœæ';
const isV = (c: string | undefined) => !!c && VOWELS.includes(c.toLowerCase());
const LETTER = /[a-zàâäçéèêëîïôöùûüÿœæ]/i;

/** Little words that lean on the next one and carry no stress. */
const CLITICS = new Set(('le la les l un une des de du d au aux à en dans sur sous par pour avec sans chez vers et ou mais donc or ni car ' +
  'que qu qui je j tu il elle on nous vous ils elles me m te t se s ce c cet cette ces mon ton son ma ta sa mes tes ses nos vos notre votre ' +
  'leur leurs ne n y se sa si quand comme').split(' '));

/** 0: mute e · 1: unstressed · 2: end of a full word · 3: end of the line or of a group (punctuation). */
export type Stress = 0 | 1 | 2 | 3;
export interface Syllable { start: number; end: number; text: string; stress: Stress; word: number }

/** Letters at the end of a word that form a mute ending (porte, portes, ils portent), if any. */
function muteEnding(w: string): number {
  const l = w.toLowerCase();
  const vowelsIn = (s: string) => [...s.replace(/[qg]u/g, '')].filter(isV).length;
  if (l.length > 4 && l.endsWith('ent') && !ENT_HEARD.has(l) && !l.endsWith('ment') && !isV(l[l.length - 4])) return 3;
  if (l.length > 3 && l.endsWith('es') && !isV(l[l.length - 3]) && vowelsIn(l.slice(0, -2)) > 0) return 2;
  if (l.length > 1 && l.endsWith('e') && vowelsIn(l.slice(0, -1)) > 0) return 1;
  return 0;
}

/** Spoken vowel groups of a word: [start, end) offsets within it. */
function vowelGroups(w: string): [number, number][] {
  const l = w.toLowerCase();
  const out: [number, number][] = [];
  for (let i = 0; i < l.length;) {
    // « qu », « gu » before a vowel: the u is silent.
    if ((l[i] === 'u') && i > 0 && (l[i - 1] === 'q' || l[i - 1] === 'g') && isV(l[i + 1])) { i++; continue; }
    if (!isV(l[i])) { i++; continue; }
    let j = i + 1;
    while (j < l.length && isV(l[j])) {
      // Hiatus: é + vowel (ré-a-li-té), vowel + é (po-é-sie), a tréma (na-ïf).
      if (l[j - 1] === 'é' || (l[j] === 'é') || l[j] === 'ï' || l[j] === 'ë' || l[j] === 'ü') break;
      j++;
    }
    out.push([i, j]);
    i = j;
  }
  return out;
}

/** Consonants that start a syllable together (pr, bl, ch…). */
const ONSETS = new Set('bl br cl cr dr fl fr gl gr pl pr tr vr ch ph th gn'.split(' '));

/** The syllables of a lyric line (without chords), with their stress. */
export function lineSyllables(text: string): Syllable[] {
  const words: { start: number; end: number; w: string }[] = [];
  const re = /[a-zàâäçéèêëîïôöùûüÿœæ]+(?:['’-][a-zàâäçéèêëîïôöùûüÿœæ]+)*/gi;
  for (let m; (m = re.exec(text));) words.push({ start: m.index, end: m.index + m[0].length, w: m[0] });
  const out: Syllable[] = [];
  words.forEach((wd, wi) => {
    // Elided words (l’amour, j’ai) are read as one: the first part has no vowel group of its own.
    const groups = vowelGroups(wd.w);
    if (!groups.length) return;
    const mute = muteEnding(wd.w.replace(/^.*['’-]/, ''));
    const muteGroup = mute && groups[groups.length - 1][0] >= wd.w.length - mute ? groups.length - 1 : -1;
    // Each syllable starts at the consonant(s) just before its vowels.
    const starts = groups.map(([g], k) => {
      if (k === 0) return 0;
      let s = g;
      const silentU = (i: number) => /u/i.test(wd.w[i]) && /[qg]/i.test(wd.w[i - 1] ?? '');
      const consonant = (i: number) => LETTER.test(wd.w[i]) && (!isV(wd.w[i]) || silentU(i));
      while (s > groups[k - 1][1] && consonant(s - 1)) s--;
      // Of several consonants, only the last one (or a pair like « pr ») opens the syllable.
      const cons = wd.w.slice(s, g).toLowerCase();
      if (cons.length >= 2) s = g - (ONSETS.has(cons.slice(-2)) || /^[qg]u$/.test(cons.slice(-2)) ? 2 : 1);
      return s;
    });
    const sylls = groups.map((_, k) => ({ start: wd.start + starts[k], end: wd.start + (k + 1 < groups.length ? starts[k + 1] : wd.w.length) }));
    const clitic = CLITICS.has(wd.w.toLowerCase().replace(/['’].*$/, '')) && !/['’]/.test(wd.w);
    const lastSpoken = muteGroup === groups.length - 1 && groups.length > 1 ? groups.length - 2 : groups.length - 1;
    // A group ends at punctuation or at the end of the line.
    const after = text.slice(wd.end, words[wi + 1]?.start ?? text.length);
    const groupEnd = wi === words.length - 1 || /[,;:.!?…—–]/.test(after);
    sylls.forEach((s, k) => {
      let stress: Stress = 1;
      if (k === muteGroup && groups.length > 1) stress = 0;
      else if (k === lastSpoken && (groupEnd || !clitic)) stress = groupEnd ? 3 : 2;
      out.push({ ...s, text: text.slice(s.start, s.end), stress, word: wi });
    });
  });
  return out;
}

export interface LineChord { chord: string; at: number }
/** A lyric line: its text without chords, and each chord with its offset in that text. */
export function splitChords(raw: string): { text: string; chords: LineChord[] } {
  let text = '';
  const chords: LineChord[] = [];
  for (const part of raw.split(/(\[[^\]]*\])/)) {
    const m = part.match(/^\[([^\]]*)\]$/);
    if (m) chords.push({ chord: m[1], at: text.length }); else text += part;
  }
  return { text, chords };
}
export const joinChords = (text: string, chords: LineChord[]) => {
  let out = '', from = 0;
  for (const c of [...chords].sort((a, b) => a.at - b.at)) { out += text.slice(from, c.at) + `[${c.chord}]`; from = c.at; }
  return out + text.slice(from);
};

export interface Misplaced { index: number; chord: string; from: Syllable; to: Syllable }

/**
 * Chords on a weak syllable with a stressed one just after (or just before): a mute e, a little
 * word, or a syllable right before its word's stress. A chord on the line's first syllable is left
 * alone (the line may start on the beat), as is one already on a stressed syllable.
 */
export function misplacedChords(raw: string): Misplaced[] {
  const { text, chords } = splitChords(raw);
  const syl = lineSyllables(text);
  const out: Misplaced[] = [];
  chords.forEach((c, index) => {
    // The syllable the chord falls on: the one at (or just after) its place.
    const i = syl.findIndex(x => x.end > c.at);
    if (i <= 0) return;
    const s = syl[i];
    if (s.stress >= 2) return;
    // A stress just after: the next syllable, or the one after when the chord is on a mute e or a little word.
    const reach = s.stress === 0 || syl[i + 1]?.word !== s.word ? 2 : 1;
    const ahead = syl.slice(i + 1, i + 1 + reach).find(x => x.stress >= 2);
    // A mute e right after a stress: back onto it (« por[A]te » → « [A]porte »).
    const behind = s.stress === 0 && syl[i - 1]?.stress >= 2 ? syl[i - 1] : undefined;
    const target = ahead ?? behind;
    if (!target) return;
    // Never two chords on one syllable.
    if (chords.some((o, j) => j !== index && o.at === target.start)) return;
    out.push({ index, chord: c.chord, from: s, to: target });
  });
  return out;
}

/** The line with the given chords moved onto their stressed syllable. */
export function alignChords(raw: string, which?: number[]): string {
  const { text, chords } = splitChords(raw);
  const moves = misplacedChords(raw).filter(m => !which || which.includes(m.index));
  if (!moves.length) return raw;
  const next = chords.map((c, i) => { const m = moves.find(x => x.index === i); return m ? { ...c, at: m.to.start } : c; });
  return joinChords(text, next);
}

/** Every line of a ChordPro text aligned (section lines and directives untouched). */
export function alignAll(chordpro: string): { text: string; moved: number } {
  let moved = 0;
  const text = chordpro.split('\n').map(l => {
    if (/^\s*\{.*\}\s*$/.test(l)) return l;
    const n = misplacedChords(l).length;
    moved += n;
    return n ? alignChords(l) : l;
  }).join('\n');
  return { text, moved };
}
