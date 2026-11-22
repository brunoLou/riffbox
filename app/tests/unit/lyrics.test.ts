import { describe, expect, it } from 'vitest';
import { analyseLyrics, findRhymes, indexWords, rhymeOf, syllables } from '../../src/lib/lyrics';
import list from '../../src/data/mots-fr.json';

describe('syllables of a sung line (classical rule)', () => {
  it('counts famous alexandrines and other verses right', () => {
    expect(syllables('Demain, dès l’aube, à l’heure où blanchit la campagne')).toBe(12);
    expect(syllables('Je partirai. Vois-tu, je sais que tu m’attends.')).toBe(12);
    expect(syllables('Il pleure dans mon cœur comme il pleut sur la ville')).toBe(12);
    expect(syllables('La mer qu’on voit danser le long des golfes clairs')).toBe(12);
    expect(syllables('Les sanglots longs des violons de l’automne')).toBe(10);
  });
  it('a mute e counts before a consonant, not before a vowel nor at the end', () => {
    expect(syllables('une porte')).toBe(3); // u-ne-porte
    expect(syllables('une amie')).toBe(3); // u-n'a-mie
    expect(syllables('la porte')).toBe(2);
    expect(syllables('elle chante doucement')).toBe(7); // el-le-chan-te-dou-ce-ment
  });
  it('verbs in -ent are mute, nouns and adverbs in -ent are heard', () => {
    expect(syllables('ils chantent')).toBe(2);
    expect(syllables('souvent')).toBe(2);
    expect(syllables('vraiment')).toBe(2);
  });
  it('chords and punctuation are ignored', () => {
    expect(syllables('[A7]J’ai pris la route [D7]avant le jour')).toBe(syllables('J’ai pris la route avant le jour'));
  });
});

describe('rhymes', () => {
  const same = (a: string, b: string) => rhymeOf(a).key === rhymeOf(b).key;
  it('words that rhyme to the ear, whatever their spelling', () => {
    for (const [a, b] of [['jour', 'toujours'], ['chanson', 'garçon'], ['nuit', 'pluie'], ['temps', 'enfant'], ['cœur', 'bonheur'],
      ['fille', 'famille'], ['porte', 'morte'], ['aimer', 'jamais'], ['peine', 'reine'], ['soleil', 'pareil'], ['voix', 'fois'], ['larme', 'arme'], ['grésille', 'brille']])
      expect(same(a, b), `${a} / ${b}`).toBe(true);
  });
  it('and those that do not', () => {
    for (const [a, b] of [['jour', 'nuit'], ['porte', 'route'], ['chanson', 'chant'], ['mer', 'mur'], ['rose', 'rouge']])
      expect(same(a, b), `${a} / ${b}`).toBe(false);
  });
  it('the scheme of a section: A B A B, a lone line has no letter, odd lengths stand out', () => {
    const [s] = analyseLyrics('{c:Couplet}\n[C]Je marche seul le long du jour\nLa ville dort sous la pluie\nJe pense encore à ton amour\nEt je chante toute la nuit\nOh');
    expect(s.label).toBe('Couplet');
    expect(s.lines.map(l => l.letter)).toEqual(['A', 'B', 'A', 'B', '']);
    expect(s.lines[4].odd).toBe(true);
    expect(s.lines.slice(0, 4).every(l => !l.odd)).toBe(true);
  });
});

describe('the rhyme dictionary', () => {
  const idx = indexWords(list as string[]);
  it('offers common words, rich rhymes first, without forms of the same word', () => {
    const r = findRhymes('chanson', idx);
    expect(r.rich.map(e => e.w)).toEqual(expect.arrayContaining(['garçon', 'façon', 'leçon']));
    expect(r.others.map(e => e.w)).toEqual(expect.arrayContaining(['maison', 'raison']));
    const all = [...r.rich, ...r.others].map(e => e.w);
    expect(all).not.toContain('chansons');
    expect(all).not.toContain('et');
    const aimer = [...findRhymes('aimer', idx).rich, ...findRhymes('aimer', idx).others].map(e => e.w);
    expect(aimer).not.toContain('aimé');
    expect(aimer).toContain('jamais');
  });
  it('gives each word its syllables', () => {
    expect(findRhymes('jour', idx).others.find(e => e.w === 'amour')?.syl).toBe(2);
  });
});
