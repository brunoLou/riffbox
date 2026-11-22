import { describe, expect, it } from 'vitest';
import { chordType, voicings } from '../../src/lib/chords';
import { STYLES, degreeChord, generateGrid, generateSection, keyForVoice, regenerateSection, seeded } from '../../src/lib/generate';
import { chordName, chordTypeId, mod12, sameChord, type Chord } from '../../src/lib/music';

const names = (cs: Chord[]) => cs.map(chordName).join(' ');

describe('degrees', () => {
  it('reads the patterns’ degrees in any key', () => {
    expect(chordName(degreeChord(0, 'vi'))).toBe('Am');
    expect(chordName(degreeChord(0, 'bVII'))).toBe('Bb');
    expect(chordName(degreeChord(7, 'ii7'))).toBe('Am7');
    expect(chordName(degreeChord(2, 'V7'))).toBe('A7');
    expect(chordName(degreeChord(0, 'III7'))).toBe('E7');
    expect(() => degreeChord(0, 'X')).toThrow();
  });
  it('every pattern of every style is valid and fits a section (4 chords)', () => {
    for (const s of STYLES) for (const role of ['verse', 'chorus', 'bridge'] as const) for (const p of s[role]) {
      const cs = p.split(' ').map(t => degreeChord(0, t));
      expect(cs, `${s.id} ${role} ${p}`).toHaveLength(4);
    }
  });
});

describe('generating a grid', () => {
  it('the same seed gives the same grid; another seed, usually another one', () => {
    const o = { key: 0, style: 'pop' as const, bars: 4 as const, bridge: true };
    expect(generateGrid(o, seeded(1))).toEqual(generateGrid(o, seeded(1)));
    const all = new Set(Array.from({ length: 30 }, (_, i) => generateGrid(o, seeded(i)).map(names).join(' | ')));
    expect(all.size).toBeGreaterThan(15);
  });
  it('sections have the asked length; the bridge is optional and 4 bars', () => {
    for (let seed = 0; seed < 40; seed++) {
      const [v, c, b] = generateGrid({ key: 4, style: STYLES[seed % STYLES.length].id, bars: 8, bridge: seed % 2 === 0 }, seeded(seed));
      expect(v).toHaveLength(8); expect(c).toHaveLength(8);
      expect(b).toHaveLength(seed % 2 === 0 ? 4 : 0);
    }
  });
  it('the chorus contrasts with the verse, the bridge with both', () => {
    for (const s of STYLES) for (let seed = 0; seed < 60; seed++) {
      const [v, c, b] = generateGrid({ key: 7, style: s.id, bars: 4, bridge: true }, seeded(seed));
      expect(sameChord(c[0], v[0]), `${s.id} ${seed}: ${names(v)} / ${names(c)}`).toBe(false);
      expect(sameChord(b[0], v[0]) && sameChord(b[0], c[0])).toBe(false);
    }
  });
  it('the chords stay in the style: no surprise outside the patterns’ degrees and their variations', () => {
    for (let seed = 0; seed < 100; seed++) {
      const [v, c] = generateGrid({ key: 0, style: 'pop', bars: 8, bridge: false }, seeded(seed));
      for (const ch of [...v, ...c]) expect(['C', 'Dm', 'Em', 'F', 'G', 'G7', 'Gsus4', 'Am', 'Am7', 'Fm', 'Ab', 'Bb'], chordName(ch)).toContain(chordName(ch));
    }
  });
  it('the key moves everything', () => {
    const a = generateGrid({ key: 0, style: 'rock', bars: 4, bridge: true }, seeded(5));
    const b = generateGrid({ key: 5, style: 'rock', bars: 4, bridge: true }, seeded(5));
    expect(b.map(s => s.map(c => mod12(c.pc - 5)))).toEqual(a.map(s => s.map(c => c.pc)));
  });
  it('every generated chord can be shown and played', () => {
    for (const s of STYLES) for (let k = 0; k < 12; k++) {
      for (const ch of generateGrid({ key: k, style: s.id, bars: 8, bridge: true }, seeded(k * 31 + 7)).flat()) {
        expect(voicings(ch.pc, chordType(chordTypeId(ch))).length, chordName(ch)).toBeGreaterThan(0);
      }
    }
  });
});

describe('« Une autre »', () => {
  it('keeps the locked chords in place and changes the rest', () => {
    const cur = generateSection(0, 'pop', 'verse', 4, seeded(3));
    cur[0] = { ...cur[0], lock: true }; cur[2] = { ...cur[2], lock: true };
    for (let seed = 0; seed < 20; seed++) {
      const next = regenerateSection(0, 'pop', 'verse', cur, seeded(100 + seed));
      expect(next).toHaveLength(4);
      expect(next[0]).toEqual(cur[0]); expect(next[2]).toEqual(cur[2]);
      expect(next.every((c, i) => sameChord(c, cur[i]))).toBe(false);
    }
  });
  it('an empty section gets four chords; a section of 8 stays 8', () => {
    expect(regenerateSection(0, 'folk', 'chorus', [], seeded(1))).toHaveLength(4);
    expect(regenerateSection(0, 'folk', 'chorus', generateSection(0, 'folk', 'chorus', 8, seeded(2)), seeded(3))).toHaveLength(8);
  });
});

describe('a key for my voice', () => {
  const fits = (r: ReturnType<typeof keyForVoice>, low: number, high: number) => r.melodyLow >= low && r.melodyHigh <= high;
  it('puts a typical melody inside the range, a little low for comfort', () => {
    // Baritone A1–F♯3 (MIDI 45–66): room 7 → tonic 2 semitones above the lowest fit.
    const r = keyForVoice(45, 66, 'pop');
    expect(fits(r, 45, 66)).toBe(true);
    expect(r.melodyHigh - r.melodyLow).toBe(14);
    expect(r.melodyLow - 45).toBeLessThanOrEqual(66 - r.melodyHigh);
  });
  it('prefers a guitar-friendly key a semitone away when it still fits', () => {
    // 51–70: the plain answer is a tonic on B♭ (58); La (57) is a semitone away and still fits.
    const low = 51, high = 70;
    const r = keyForVoice(low, high, 'pop');
    expect(r.key).toBe(9);
    expect(fits(r, low, high)).toBe(true);
  });
  it('a voice of every height gets a key, and the melody fits whenever the range is wide enough', () => {
    for (let low = 40; low <= 64; low++) {
      const r = keyForVoice(low, low + 17, 'folk');
      expect(fits(r, low, low + 17), `${low}`).toBe(true);
      expect(r.key).toBeGreaterThanOrEqual(0);
    }
  });
  it('a style centred on the relative minor: the grid key is its relative major', () => {
    const r = keyForVoice(45, 66, 'chanson');
    expect(fits(r, 45, 66)).toBe(true);
    expect(mod12(r.key + 9)).toBe(mod12(r.tonic)); // the melody's tonic is vi of the grid key
  });
});
