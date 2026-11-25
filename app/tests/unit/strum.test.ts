import { describe, expect, it } from 'vitest';
import { MODEL_RHYTHMS, barSlots, chordFromNotes, commonPatterns, pendulum, strokeText, strokesFromNotes, type RNote } from '../../src/lib/strum';
import { readGuitarPro } from '../../src/lib/guitarPro';

const n = (len: number, extra: Partial<RNote> = {}): RNote => ({ len, ...extra });

describe('notes become strokes', () => {
  it('quarter and eighth notes: down on the beat, up on the « and »', () => {
    // ♩ ♪♪ ♪♪ ♩  →  ↓ ↓↑ ↓↑ ↓
    const s = strokesFromNotes([n(4), n(2), n(2), n(2), n(2), n(4)], 16);
    expect(strokeText(s)).toBe('↓·↓↑↓↑↓·');
  });
  it('a rest or a tie is a stroke in the air', () => {
    // ♩ ♪ ♪(tied) ♪ ♪ (rest)♩  : the classic D DU UDU
    const s = strokesFromNotes([n(4), n(2), n(2), n(2, { tie: true }), n(2), n(2), n(2)], 16);
    expect(strokeText(s)).toBe('↓·↓↑·↑↓↑');
    expect(strokeText(strokesFromNotes([n(4, { rest: true }), n(4), n(4), n(4)], 16))).toBe('··↓·↓·↓·');
  });
  it('sixteenths switch the hand to sixteenths', () => {
    const s = strokesFromNotes([n(1), n(1), n(2), n(4), n(4), n(4)], 16);
    expect(strokeText(s)).toBe('↓↑↓·↓···↓···↓···');
    expect(pendulum(3, true)).toBe('U');
    expect(pendulum(2, false)).toBe('U');
    expect(pendulum(4, false)).toBe('D');
  });
  it('compound time: eighths alternate', () => {
    expect(barSlots(6, 8)).toBe(12);
    expect(strokeText(strokesFromNotes([n(2), n(2), n(2), n(2), n(2), n(2)], 12))).toBe('↓↑↓↑↓↑');
  });
  it('ready-made patterns follow the pendulum (except the all-down rock)', () => {
    for (const r of MODEL_RHYTHMS) {
      if (r.id === 'm-rock') continue;
      const s = r.bars[0].slots, six = s.some((x, i) => x !== '-' && i % 2 === 1);
      s.forEach((x, i) => { if (x !== '-') expect(x, `${r.id} position ${i}`).toBe(pendulum(i, six)); });
    }
  });
});

describe('chords from notes', () => {
  it('names open and barre chords', () => {
    expect(chordFromNotes([40, 47, 52, 55, 59, 64])).toBe('Em');
    expect(chordFromNotes([45, 52, 57, 61, 64])).toBe('A');
    expect(chordFromNotes([43, 47, 50, 55, 59, 65])).toBe('G7');
    expect(chordFromNotes([40, 47])).toBe('E5');
    expect(chordFromNotes([40])).toBeNull();
  });
  it('finds the patterns a song repeats', () => {
    const a = { slots: strokesFromNotes([n(4), n(4), n(4), n(4)], 16) }, b = { slots: strokesFromNotes([n(2), n(2), n(2), n(2), n(8)], 16) };
    const p = commonPatterns([a, b, a, a, { slots: strokesFromNotes([n(16, { rest: true })], 16) }]);
    expect(p.map(x => x.count)).toEqual([3, 1]);
  });
});

describe('Guitar Pro', () => {
  it('reads strokes, brush directions, chords and tempo from a .gp file', async () => {
    const at = await import('@coderline/alphatab/core');
    const s = new at.Settings();
    const EM = '(0.6 2.5 2.4 0.3 0.2 0.1)', G = '(3.6 2.5 0.4 0.3 3.2 3.1)';
    const tex = `\\title "Essai" \\tempo 96 . \\track "Rythmique" \\ts 4 4 ${EM}.4 ${EM}.8 ${EM}.8 r.8 ${EM}.8 ${EM}.4 | ${G}.4{bu} ${G}.8{bd} r.8 ${G}.2 \\track "Solo" 5.1.8 7.1.8 r.2.`;
    const imp = new at.importer.AlphaTexImporter();
    imp.initFromString(tex, s);
    const bytes = new at.exporter.Gp7Exporter().export(imp.readScore(), s);
    const song = await readGuitarPro(bytes);
    expect(song.title).toBe('Essai');
    expect(song.bpm).toBe(96);
    expect(song.tracks.map(t => t.name)).toEqual(['Rythmique', 'Solo']);
    const [r] = song.tracks;
    expect(r.bars.map(b => b.chord)).toEqual(['Em', 'G']);
    expect(strokeText(r.bars[0].slots)).toBe('↓·↓↑·↑↓·');
    // Bar 2: the file says up, then down.
    expect(strokeText(r.bars[1].slots)).toBe('↑·↓·↓···');
    expect(r.rounded).toBe(false);
  });
  it('refuses a file that is not Guitar Pro', async () => {
    await expect(readGuitarPro(new TextEncoder().encode('bonjour'))).rejects.toThrow(/Guitar Pro/);
  });
});

describe('playing a pattern', async () => {
  const { strumPattern, voicing } = await import('../../src/lib/strumPlay');
  const pop = MODEL_RHYTHMS.find(r => r.id === 'm-pop')!;
  it('one step per sixteenth, each giving its position; strokes as chords', () => {
    const p = strumPattern(pop.bars, { bpm: 90, den: 4, click: true, fallbackChord: 'Em' });
    expect(p.steps).toHaveLength(16);
    expect(p.stepDur).toBeCloseTo(60 / 90 / 4);
    expect(p.steps.map(s => s.beat)).toEqual([...Array(16).keys()]);
    const chordAt = (i: number) => p.steps[i].hits.find(h => typeof h !== 'string' && 'chord' in h) as { chord: number[]; vol: number } | undefined;
    expect(chordAt(0)!.chord).toEqual(voicing('Em')!.notes);
    // Up strokes: the treble strings only, softer.
    expect(chordAt(6)!.chord).toHaveLength(3);
    expect(chordAt(6)!.vol).toBeLessThan(chordAt(0)!.vol);
    expect(chordAt(2)).toBeUndefined();
    expect(p.steps[0].hits).toContain('accent');
    expect(p.steps[4].hits).toContain('beat');
  });
  it('swing plays eighths on a triplet grid; 6/8 counts dotted quarters', () => {
    const sh = MODEL_RHYTHMS.find(r => r.id === 'm-shuffle')!;
    const p = strumPattern(sh.bars, { bpm: 96, den: 4, swing: true });
    expect(p.steps).toHaveLength(12);
    expect(p.steps.slice(0, 3).map(s => s.beat)).toEqual([0, null, 2]);
    const b = MODEL_RHYTHMS.find(r => r.id === 'm-ballade')!;
    const q = strumPattern(b.bars, { bpm: 60, den: 8 });
    expect(q.steps).toHaveLength(12);
    expect(q.stepDur).toBeCloseTo(1 / 6);
  });
  it('a grid gets drums and bass', () => {
    const p = strumPattern([{ slots: pop.bars[0].slots, chord: 'A' }], { bpm: 100, den: 4, band: true });
    expect(p.steps[0].hits).toEqual(expect.arrayContaining(['kick', 'hatAcc']));
    expect(p.steps[4].hits).toContain('snare');
    expect(p.steps[0].hits.some(h => typeof h !== 'string' && 'bass' in h && h.bass === 45)).toBe(true);
  });
});
