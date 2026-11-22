/**
 * Help with lyrics: syllables per line (French sung verse), rhymes and the rhyme scheme.
 * A small rule-based French pronunciation (enough for word endings and syllable counts),
 * with the usual exceptions. Phonemes, one character each:
 *   vowels  a e (é/è merged for rhymes later) E i o U(ou) y(u) 2(eu) @(schwa) A(an) I(in) O(on)
 *   others  consonants as letters, S(ch) Z(j) N(gn) j w (semi-vowels)
 */

const VOWEL_LETTERS = 'aàâäeéèêëiîïoôöuùûüyœæ';
/** '#' marks a dropped mute e: the letters before it read as before a vowel (peine, rose, porte). */
const isVowelLetter = (c: string | undefined) => !!c && (VOWEL_LETTERS.includes(c) || c === '#');
/** A vowel actually written (semi-vowels: « i », « ou » before one become j, w). */
const isRealVowel = (c: string | undefined) => !!c && VOWEL_LETTERS.includes(c);
export const VOWELS = 'aeEioUy2@AIO';
const isVowel = (p: string | undefined) => !!p && VOWELS.includes(p);

/** Whole words read differently from their spelling. */
const WHOLE: Record<string, string> = {
  et: 'e', est: 'E', es: 'E', les: 'le', des: 'de', mes: 'me', tes: 'te', ses: 'se', ces: 'se',
  pays: 'pEi', monsieur: 'm@sj2', femme: 'fam', femmes: 'fam', oignon: 'oNO', second: 's@gO', seconde: 's@gOd',
  fils: 'fis', os: 'os', plus: 'ply', tous: 'tus', ville: 'vil', villes: 'vil', mille: 'mil', tranquille: 'trAkil',
  eu: 'y', eus: 'y', eut: 'y', août: 'Ut', yeux: 'j2', oeil: '2j', œil: '2j', twist: 'twist',
  hier: 'jEr', fier: 'fjEr', fiers: 'fjEr', hiver: 'ivEr', enfer: 'AfEr', amer: 'amEr', cher: 'SEr', chers: 'SEr',
  mer: 'mEr', fer: 'fEr', ver: 'vEr', vers: 'vEr', hiers: 'jEr', super: 'sypEr', cancer: 'kAsEr', revolver: 'revolvEr',
  sept: 'sEt', huit: 'yit', net: 'nEt', but: 'byt', brut: 'bryt', ouest: 'wEst', zut: 'zyt', chut: 'Syt',
  six: 'sis', dix: 'dis', sens: 'sAs', ours: 'urs', mars: 'mars', hélas: 'elas', jadis: 'Zadis',
  blanc: 'blA', franc: 'frA', banc: 'bA', tabac: 'taba', estomac: 'Estoma', porc: 'por', clef: 'kle', nerf: 'nEr',
  gentil: 'ZAti', outil: 'uti', fusil: 'fyzi', persil: 'pErsi', sourcil: 'sursi', nombril: 'nObri', cul: 'ky',
  aiment: 'Em', sèment: 'sEm', ferment: 'fErm', dorment: 'dorm', ont: 'O', font: 'fO', sont: 'sO', vont: 'vO',
};
/** Words in -ent whose ending is heard (nouns, adjectives, adverbs), unlike verbs (ils chantent). */
export const ENT_HEARD = new Set(('souvent parent parents serpent présent présents content contents absent absents accident accidents argent ' +
  'talent talents client clients urgent prudent patient patients violent violents différent différents évident récent récents ' +
  'adolescent innocent innocents décent ardent torrent torrents vent vents dent dents lent lents cent cents sent ment rent ' +
  'comment moment moments instant instants pourtant serment serments sentiment sentiments firmament ciment aliment océan ' +
  'agent agents équivalent fréquent fréquents silence excellent excellents intelligent intelligents insolent indulgent ' +
  'transparent transparents événement événements président présidents incident incidents continent continents orient occident ' +
  'diligent régent régents argument arguments couvent couvents strident permanent permanents apparent apparents').split(' '));
/** Words ending in -er, -ier read « èr » although longer than three letters (others: « é »). */
const H_ASPIRE = new Set(('haut hauts haute hautes héros hibou hache haine haïr hasard honte huit hurler hall hanche harpe hêtre hors ' +
  'hall hameau hangar hareng haricot harnais hausse havre hérisson hiérarchie hockey homard hongrie hoquet houle housse ' +
  'hublot huée hulotte hutte hyène handicap hamac hamster hachis halte hamburger hard hip hop hippie hold-up').split(' '));

const T_HEARD = new Set('direct correct strict exact tact contact intact rapt compact abrupt infect suspect fat mat scout ticket'.split(' '));
const S_HEARD = new Set('bus as atlas iris virus cactus bonus campus sinus tennis oasis maïs lys vis autobus prospectus rhinocéros sens ours mars jadis hélas bis tournevis gratis albatros'.split(' '));
const X_HEARD = new Set('index lynx silex thorax larynx sphinx phénix latex fax relax max'.split(' '));

/** Final silent letters, mute e and other endings: what is left to pronounce, and whether a mute e was dropped. */
function stripEnding(w: string): { core: string; muteE: boolean } {
  let core = w;
  // -ent of a verb (ils chantent) is a mute e; elsewhere « an ».
  if (core.length > 4 && core.endsWith('ent') && !ENT_HEARD.has(core) && !core.endsWith('ment')) core = core.slice(0, -2);
  else if (core.endsWith('ments') || core.endsWith('ment')) { /* moment, vraiment: heard */ }
  if (core.length > 3 && core.endsWith('es')) core = core.slice(0, -1);
  if (core.length > 1 && core.endsWith('e')) {
    const rest = core.slice(0, -1);
    // A word whose only vowel is this e (le, que, je) keeps it.
    if ([...rest.replace(/[qg]u/g, '')].some(isVowelLetter)) return { core: rest + '#', muteE: !isVowelLetter(rest[rest.length - 1]) || /(qu|gu)$/.test(rest) };
  }
  // Silent final consonants (the mute e above keeps them heard: porte, grande).
  if (/[sxz]$/.test(core) && core.length > 2 && !S_HEARD.has(core) && !X_HEARD.has(core)) core = core.slice(0, -1);
  if (/er$/.test(core) && core.length > 3) return { core: core.slice(0, -2) + 'é', muteE: false };
  if (/ez$/.test(core)) return { core: core.slice(0, -2) + 'é', muteE: false };
  if (/et$/.test(core) && core.length > 3) return { core: core.slice(0, -2) + 'è', muteE: false };
  if (/[tdpg]$/.test(core) && core.length > 2 && !T_HEARD.has(core)) {
    core = core.slice(0, -1);
    if (/[tdpg]$/.test(core) && !/[nm]$/.test(core.slice(0, -1))) core = core.slice(0, -1); // doigt, temps → tem
  }
  return { core, muteE: false };
}

/** Phonemes of one word (approximate). */
export function phon(word: string): { p: string; muteE: boolean } {
  const w = word.toLowerCase().replace(/[’'`-]/g, '').normalize('NFC');
  if (!w) return { p: '', muteE: false };
  if (WHOLE[w]) return { p: WHOLE[w], muteE: false };
  const { core, muteE } = stripEnding(w);
  const s = core;
  let out = '';
  const at = (i: number, str: string) => s.startsWith(str, i);
  const nasalHere = (i: number, len: number) => {
    const n = s[i + len];
    return (n === 'n' || n === 'm') && !isVowelLetter(s[i + len + 1]) && s[i + len + 1] !== 'n' && s[i + len + 1] !== 'm';
  };
  for (let i = 0; i < s.length;) {
    const c = s[i], next = s[i + 1];
    if (c === '#') { i += 1; continue; }
    // Vowel groups, longest first.
    if (at(i, 'eau')) { out += 'o'; i += 3; continue; }
    if (at(i, 'ill') && i > 0 && isVowelLetter(s[i - 1])) { out += 'j'; i += 3; continue; }
    if (at(i, 'ill') && i > 0) { out += 'ij'; i += 3; continue; }
    if ((at(i, 'ail') || at(i, 'eil')) && i + 3 === s.length) { out += c === 'a' ? 'aj' : 'Ej'; i += 3; continue; }
    if ((at(i, 'euil') || at(i, 'ueil') || at(i, 'œil')) && i + (c === 'œ' ? 3 : 4) >= s.length) { out += '2j'; i += c === 'œ' ? 3 : 4; continue; }
    if (at(i, 'ouil') && i + 4 === s.length) { out += 'Uj'; i += 4; continue; }
    if (at(i, 'oin') && nasalHere(i + 1, 1)) { out += 'wI'; i += 3; continue; }
    if (at(i, 'ien') && nasalHere(i + 1, 1)) { out += 'jI'; i += 3; continue; }
    if ((at(i, 'ain') || at(i, 'aim') || at(i, 'ein') || at(i, 'eim')) && nasalHere(i, 2)) { out += 'I'; i += 3; continue; }
    if ((c === 'i' || c === 'y' || c === 'u') && nasalHere(i, 1)) { out += 'I'; i += 2; continue; }
    if ((c === 'a' || c === 'e') && nasalHere(i, 1)) { out += 'A'; i += 2; continue; }
    if (c === 'o' && nasalHere(i, 1)) { out += 'O'; i += 2; continue; }
    if (at(i, 'oi') || at(i, 'oî') || at(i, 'oy')) { out += 'wa'; i += 2; continue; }
    if (at(i, 'ou') || at(i, 'oû') || at(i, 'où')) { out += isRealVowel(s[i + 2]) && s[i + 2] !== 'e' ? 'w' : 'U'; i += 2; continue; }
    if (at(i, 'au')) { out += 'o'; i += 2; continue; }
    if (at(i, 'ai') || at(i, 'aî') || at(i, 'ei')) { out += 'E'; i += 2; continue; }
    if (at(i, 'eu') || at(i, 'eû') || at(i, 'œu')) { out += '2'; i += 2; continue; }
    if (c === 'œ') { out += '2'; i += 1; continue; }
    if (at(i, 'tion') && s[i - 1] !== 's') { out += 'sjO'; i += 4; continue; }
    // Consonant groups.
    if (at(i, 'ch')) { out += 'S'; i += 2; continue; }
    if (at(i, 'ph')) { out += 'f'; i += 2; continue; }
    if (at(i, 'th')) { out += 't'; i += 2; continue; }
    if (at(i, 'gn')) { out += 'N'; i += 2; continue; }
    if (at(i, 'qu')) { out += 'k'; i += 2; continue; }
    if (at(i, 'gu') && /[eiéèêy#]/.test(s[i + 2] ?? '')) { out += 'g'; i += 2; continue; }
    if (at(i, 'ge') && /[aoâôu]/.test(s[i + 2] ?? '')) { out += 'Z'; i += 2; continue; }
    if (c === 'g' && /[eiéèêëîy#]/.test(next ?? '')) { out += 'Z'; i += 1; continue; }
    if (c === 'c' && /[eiéèêëîy#]/.test(next ?? '')) { out += 's'; i += 1; continue; }
    if (c === 'c' && next === 'c' && /[eiéèê]/.test(s[i + 2] ?? '')) { out += 'ks'; i += 2; continue; }
    if (c === 'ç') { out += 's'; i += 1; continue; }
    if (c === 'x') { out += i === 0 ? 'gz' : 'ks'; i += 1; continue; }
    if (c === 'j') { out += 'Z'; i += 1; continue; }
    if (c === 'h') { i += 1; continue; }
    if (c === 's' && next === 's') { out += 's'; i += 2; continue; }
    if (c === 's' && isVowelLetter(s[i - 1]) && isVowelLetter(next)) { out += 'z'; i += 1; continue; }
    if (c === 'y') { out += isVowelLetter(s[i - 1]) && isVowelLetter(next) ? 'j' : 'i'; i += 1; continue; }
    if (c === 'w') { out += 'w'; i += 1; continue; }
    if (c === 'k' || c === 'q' || c === 'c') { out += 'k'; i += c === 'c' && next === 'k' ? 2 : 1; continue; }
    // Single vowels.
    if (c === 'é') { out += 'e'; i += 1; continue; }
    if (c === 'è' || c === 'ê' || c === 'ë') { out += 'E'; i += 1; continue; }
    if (c === 'a' || c === 'à' || c === 'â' || c === 'ä') { out += 'a'; i += 1; continue; }
    if (c === 'i' || c === 'î' || c === 'ï') { out += c === 'i' && isRealVowel(next) && next !== 'e' && i > 0 ? 'j' : 'i'; i += 1; continue; }
    if (c === 'o' || c === 'ô' || c === 'ö') { out += 'o'; i += 1; continue; }
    if (c === 'u' || c === 'û' || c === 'ù' || c === 'ü') { out += 'y'; i += 1; continue; }
    if (c === 'e') {
      // « è » before two consonants or a final consonant (belle, mer, avec), else a schwa.
      const n1 = s[i + 1], n2 = s[i + 2];
      const closed = (n1 && !isVowelLetter(n1) && (n2 === undefined || (!isVowelLetter(n2) && !/[lr]/.test(n2)) || n1 === n2));
      out += closed ? 'E' : '@';
      i += 1; continue;
    }
    // Other consonants; doubles once.
    if (c === next) { out += c; i += 2; continue; }
    out += c; i += 1;
  }
  return { p: out, muteE };
}

const syllablesOf = (p: string) => [...p].filter(isVowel).length;

/** Words of a lyric line (chords and punctuation removed). */
export function words(line: string): string[] {
  return line.replace(/\[[^\]]*\]/g, '').toLowerCase().split(/[^a-zàâäçéèêëîïôöùûüÿœæ'’-]+/).map(w => w.replace(/^['’-]+|['’-]+$/g, '')).filter(Boolean);
}
const startsWithVowelSound = (w: string) => isVowelLetter(w[0]) || (w[0] === 'h' && !H_ASPIRE.has(w.replace(/['’].*/, '')));

/**
 * Syllables of a sung line, by the classical rule: a mute e at the end of a word counts before a
 * consonant, is elided before a vowel (or a mute h), and never counts at the end of the line.
 */
export function syllables(line: string): number {
  const ws = words(line);
  let n = 0;
  ws.forEach((w, i) => {
    const { p, muteE } = phon(w);
    n += Math.max(syllablesOf(p), w.length ? 1 : 0);
    const nx = ws[i + 1];
    if (muteE && nx && !startsWithVowelSound(nx)) n += 1;
  });
  return n;
}

/** The rhyme of a word: its last vowel and what follows (é and è merged), and the sound before it. */
export function rhymeOf(word: string): { key: string; lead: string } {
  const p = phon(word).p.replace(/E/g, 'e');
  let i = p.length - 1;
  while (i >= 0 && !isVowel(p[i])) i--;
  if (i < 0) return { key: '', lead: '' };
  return { key: p.slice(i), lead: p[i - 1] ?? '' };
}
export const lastWord = (line: string) => { const ws = words(line); return ws[ws.length - 1] ?? ''; };

export interface LyricLine { index: number; text: string; syllables: number; rhyme: string; letter: string; odd: boolean }
export interface LyricSection { label: string; lines: LyricLine[]; usual: number }

/**
 * Lines of a ChordPro text, grouped by section, with their syllables, their rhyme letter
 * (A, B, A, B… within the section) and whether their length stands out from the section's usual one.
 */
export function analyseLyrics(chordpro: string): LyricSection[] {
  const out: LyricSection[] = [];
  let cur: LyricSection | null = null;
  chordpro.split('\n').forEach((raw, index) => {
    const sec = raw.match(/^\s*\{(?:c|comment|soc|start_of_chorus)(?::\s*(.*))?\}\s*$/);
    if (sec) { cur = { label: sec[1]?.trim() || 'Refrain', lines: [], usual: 0 }; out.push(cur); return; }
    if (/^\s*\{.*\}\s*$/.test(raw)) return;
    const text = raw.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
    if (!words(text).length) return;
    if (!cur) { cur = { label: '', lines: [], usual: 0 }; out.push(cur); }
    cur.lines.push({ index, text, syllables: syllables(text), rhyme: rhymeOf(lastWord(text)).key, letter: '', odd: false });
  });
  for (const s of out) {
    const letters = new Map<string, string>();
    for (const l of s.lines) {
      if (!l.rhyme) continue;
      if (!letters.has(l.rhyme)) letters.set(l.rhyme, String.fromCharCode(65 + letters.size));
      l.letter = letters.get(l.rhyme)!;
    }
    // A letter only for rhymes heard twice or more; a lone line has none.
    const count = (k: string) => s.lines.filter(l => l.rhyme === k).length;
    const kept = [...letters.keys()].filter(k => count(k) > 1);
    const relabel = new Map(kept.map((k, i) => [k, String.fromCharCode(65 + i)]));
    for (const l of s.lines) l.letter = relabel.get(l.rhyme) ?? '';
    // The usual length: the median; a line 3 syllables or more away from it stands out.
    const sorted = s.lines.map(l => l.syllables).sort((a, b) => a - b);
    s.usual = sorted.length ? Math.round((sorted[(sorted.length - 1) >> 1] + sorted[sorted.length >> 1]) / 2) : 0;
    for (const l of s.lines) l.odd = s.lines.length > 2 && Math.abs(l.syllables - s.usual) >= 3;
  }
  return out;
}

/* ---------- Rhyme finder ---------- */

export interface RhymeEntry { w: string; key: string; lead: string; syl: number }
/** The rhyme dictionary, indexed once (words in order of frequency). */
export function indexWords(list: string[]): Map<string, RhymeEntry[]> {
  const by = new Map<string, RhymeEntry[]>();
  for (const w of list) {
    const { key, lead } = rhymeOf(w);
    if (!key) continue;
    const e = { w, key, lead, syl: Math.max(1, syllablesOf(phon(w).p)) };
    const a = by.get(key);
    if (a) a.push(e); else by.set(key, [e]);
  }
  return by;
}

/** Little grammar words, not worth offering as rhymes. */
const STOP = new Set(('et est es ai as a les des mes tes ses ces le la de du un une je tu il on ne se ce me te que qui ou où y en au aux ' +
  'mon ton son ma ta sa nos vos ont sont vont font suis sais fait dit ils elles nous vous eux leur lui moi toi soi si ni').split(' '));

/** Words that rhyme with `word`: rich rhymes (same sound before) first, then the others; most common first. */
export function findRhymes(word: string, index: Map<string, RhymeEntry[]>, max = 60): { rich: RhymeEntry[]; others: RhymeEntry[] } {
  const { key, lead } = rhymeOf(word);
  const w = word.toLowerCase();
  const stem = (x: string) => x.replace(/[sx]$/, '').replace(/oe/g, 'œ');
  // Forms of the same word (aimer, aimé, aimait) do not count as rhymes.
  const sameFamily = (x: string) => { let k = 0; while (k < x.length && x[k] === w[k]) k++; return k >= 3 && k >= Math.min(x.length, w.length) - 2; };
  const all = (index.get(key) ?? []).filter(e => !sameFamily(e.w) && !STOP.has(e.w) && !e.w.includes('-') && stem(e.w) !== stem(w) && !stem(w).endsWith(stem(e.w)) && !stem(e.w).endsWith(stem(w)));
  // One spelling per sound: « chanson » once, not also « chansons ».
  const seen = new Set<string>();
  const uniq = all.filter(e => { const k = stem(e.w); if (seen.has(k)) return false; seen.add(k); return true; });
  const rich = lead ? uniq.filter(e => e.lead === lead) : [];
  const others = uniq.filter(e => !rich.includes(e));
  return { rich: rich.slice(0, max), others: others.slice(0, max) };
}
