import { describe, expect, it } from 'vitest';
import { readBackup, summarize } from '../../src/lib/backup';
import { TRACKS, buildBacking, chordLabel } from '../../src/lib/backing';
import { bestCapo, capoOptions, signedShift } from '../../src/lib/capo';
import { INITIAL_GRIDS, gridChordPro } from '../../src/lib/grids';
import { DEFAULT_PEDAL_KEYS, actionFor, assignKey, canBePedal, keyLabel } from '../../src/lib/pedal';
import { hasLyrics, keyChords, songById } from '../../src/lib/setlists';

describe('capo', () => {
  it('needs no capo in an open key', () => expect(bestCapo(9)).toMatchObject({ capo: 0, label: 'La' }));
  it('finds open shapes for B flat', () => expect(bestCapo(10)).toMatchObject({ capo: 1, label: 'La' }));
  it('works in minor', () => expect(bestCapo(11, true)).toMatchObject({ capo: 2, label: 'La m' }));
  it('lists frets 0 to 9', () => expect(capoOptions(0).map(o => o.capo)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
  it('signs shifts between -5 and +6', () => {
    expect(signedShift(10)).toBe(-2);
    expect(signedShift(6)).toBe(6);
    expect(signedShift(-1)).toBe(-1);
  });
});

describe('songs and grids', () => {
  it('turns a grid into a chord chart', () => {
    expect(gridChordPro(INITIAL_GRIDS[0]).split('\n').slice(0, 2)).toEqual(['{c:Couplet}', '[A][D][A][E]']);
  });
  it('tells lyrics from chord charts', () => {
    expect(hasLyrics('{c:Couplet}\n[A][D]')).toBe(false);
    expect(hasLyrics('[A]Minuit shuffle')).toBe(true);
    expect(hasLyrics(undefined)).toBe(false);
  });
  it('shows a catalog song without lyrics with its grid', () => {
    expect(songById('s2')).toMatchObject({ title: 'Café noir', fromGrid: true });
    expect(songById('s2')!.chordpro).toContain('[Dm]');
  });
  it('offers the chords of a key', () => {
    expect(keyChords(0)).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'G7']);
    expect(keyChords(4, true)).toEqual(['Em', 'G', 'Am', 'Bm', 'C', 'D', 'B7']);
    expect(keyChords(5)).toEqual(['F', 'Gm', 'Am', 'Bb', 'C', 'Dm', 'C7']);
  });
});

describe('backing tracks', () => {
  it('builds a 12-bar shuffle', () => {
    const t = TRACKS.find(x => x.id === 'b1')!;
    const p = buildBacking(t, t.key, t.bpm);
    expect(p.steps).toHaveLength(12 * 12);
    expect(p.stepDur).toBeCloseTo(60 / 90 / 3, 6);
    expect(p.steps.filter(s => s.beat !== null)).toHaveLength(48);
  });
  it('names the bars', () => {
    const t = TRACKS.find(x => x.id === 'b1')!;
    expect(t.bars.map(b => chordLabel(9, b)).slice(0, 4)).toEqual(['A7', 'D7', 'A7', 'A7']);
  });
});

describe('backup files', () => {
  const file = (o: unknown) => new File([typeof o === 'string' ? o : JSON.stringify(o)], 'b.json', { type: 'application/json' });
  it('rejects files that are not backups', async () => {
    await expect(readBackup(file('pas du json'))).rejects.toThrow('format illisible');
    await expect(readBackup(file({ hello: 1 }))).rejects.toThrow('n’est pas une sauvegarde');
    await expect(readBackup(file({ app: 'riffbox', version: 99, data: {} }))).rejects.toThrow('plus récente');
    await expect(readBackup(file({ app: 'riffbox', version: 1, data: { ideas: 'x' } }))).rejects.toThrow('abîmée');
    await expect(readBackup(file({ app: 'riffbox', version: 1, data: {}, audio: { a: 'blob:x' } }))).rejects.toThrow('abîmée');
  });
  it('reads and summarises a valid backup', async () => {
    const b = await readBackup(file({ app: 'riffbox', version: 1, exportedAt: '2026-11-20T10:00:00Z', data: { ideas: [{ id: 'a' }], setlists: [], 'practice.log': { d1: 30, d2: 0 } }, audio: { a: 'data:audio/webm;base64,AA==' } }));
    expect(summarize(b)).toMatchObject({ ideas: 1, setlists: 0, recordings: 1, days: 1 });
  });
});

describe('pedal keys', () => {
  it('matches the default page-turner keys', () => {
    expect(actionFor(DEFAULT_PEDAL_KEYS, 'PageDown')).toBe('right');
    expect(actionFor(DEFAULT_PEDAL_KEYS, 'ArrowUp')).toBe('left');
    expect(actionFor(DEFAULT_PEDAL_KEYS, ' ')).toBe('middle');
    expect(actionFor(DEFAULT_PEDAL_KEYS, 'Enter')).toBeNull();
  });
  it('learning a key moves it from one pedal to another', () => {
    const k = assignKey(DEFAULT_PEDAL_KEYS, 'left', 'ArrowRight');
    expect(k.left).toContain('ArrowRight');
    expect(k.right).not.toContain('ArrowRight');
    expect(actionFor(k, 'ArrowRight')).toBe('left');
    expect(assignKey(k, 'left', 'ArrowRight').left.filter(x => x === 'ArrowRight')).toHaveLength(1);
  });
  it('ignores the case of letters', () => {
    const k = assignKey(DEFAULT_PEDAL_KEYS, 'middle', 'B');
    expect(actionFor(k, 'b')).toBe('middle');
    expect(keyLabel('b')).toBe('B');
  });
  it('never takes modifiers, Tab or Escape', () => {
    for (const key of ['Shift', 'Tab', 'Escape']) expect(canBePedal(key)).toBe(false);
    expect(canBePedal('Enter')).toBe(true);
  });
});
