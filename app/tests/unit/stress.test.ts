import { describe, expect, it } from 'vitest';
import { SONG } from '../../src/lib/data';
import { alignAll, alignChords, joinChords, lineSyllables, misplacedChords, splitChords } from '../../src/lib/stress';

const marks = (line: string) => lineSyllables(line).map(s => s.text + '₀₁₂₃'[s.stress]).join('|');

describe('stress in a French line', () => {
  it('the last spoken syllable of each full word, strongest at the end and before punctuation', () => {
    expect(marks('J’ai pris la route avant le jour')).toBe('J’ai₂|pris₂|la₁|rou₂|te₀|a₁|vant₂|le₁|jour₃');
    expect(marks('Le moteur tousse, la radio grésille')).toBe('Le₁|mo₁|teur₂|tous₃|se₀|la₁|ra₁|dio₂|gré₁|sil₃|le₀');
  });
  it('mute endings (e, es, verbs in -ent) are never stressed; nouns in -ent are', () => {
    expect(marks('Ils chantent souvent')).toBe('Ils₁|chan₂|tent₀|sou₁|vent₃');
    expect(marks('les portes')).toBe('les₁|por₃|tes₀');
  });
  it('vowels apart in a hiatus, together in a diphthong; qu and gu', () => {
    expect(marks('la poésie des réalités')).toBe('la₁|po₁|é₁|sie₂|des₁|ré₁|a₁|li₁|tés₃');
    expect(marks('quelque guitare')).toBe('quel₂|que₀|gui₁|ta₃|re₀');
  });
});

describe('chords on the strong beats', () => {
  it('splits and joins a line without changing it', () => {
    for (const l of SONG.split('\n')) { const { text, chords } = splitChords(l); expect(joinChords(text, chords)).toBe(l); }
  });
  it('a chord on a little word or just before the stress moves onto the stress', () => {
    expect(alignChords('[A7]J’ai pris la route [D7]avant le jour')).toBe('[A7]J’ai pris la route a[D7]vant le jour');
    expect(alignChords('[C]Je chante [G]sous la pluie')).toBe('[C]Je chante sous la [G]pluie');
    expect(alignChords('[E7]Le vent me pousse, [D7]la nuit [A7]brille')).toBe('[E7]Le vent me pousse, la [D7]nuit [A7]brille');
  });
  it('a chord on a mute e goes back onto the stressed syllable before it', () => {
    expect(alignChords('Le moteur tous[C]se la radio')).toBe('Le moteur [C]tousse la radio');
  });
  it('chords already on a stress, or on the first syllable of the line, stay', () => {
    for (const l of ['[A]Le moteur [D]tousse', 'Il pleure dans mon [Am]cœur', '[G]Trois cents bornes']) expect(misplacedChords(l)).toEqual([]);
  });
  it('never two chords on one syllable; only the chosen chords move', () => {
    expect(misplacedChords('la [C]la [G]nuit')).toEqual([]); // la [C]la → nuit would meet G
    expect(misplacedChords('[C]Le vent [G]me [D]pousse')).toEqual([]); // « pous » already has D
    expect(misplacedChords('[C]Le vent [G]me pousse').map(m => `${m.chord} ${m.to.text}`)).toEqual(['G pous']);
    expect(alignChords('[A]Je [D]la [E]vois sous [G]la pluie', [3])).toBe('[A]Je [D]la [E]vois sous la [G]pluie');
  });
  it('a whole song: lines touched only where needed, directives kept; aligning twice changes nothing more', () => {
    const r = alignAll(SONG);
    expect(r.moved).toBeGreaterThan(5);
    expect(r.text.split('\n').filter(l => l.startsWith('{c:'))).toEqual(SONG.split('\n').filter(l => l.startsWith('{c:')));
    expect(r.text.replace(/\[[^\]]*\]/g, '')).toBe(SONG.replace(/\[[^\]]*\]/g, ''));
    expect(alignAll(r.text).moved).toBe(0);
  });
});
