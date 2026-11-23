import { describe, expect, it } from 'vitest';
import { TILES } from '../../src/lib/data';
import { LOOKS } from '../../src/lib/pedalLooks';

describe('home pedals', () => {
  it('every pedal has its own look: colour, drawing, and controls with footswitch', () => {
    expect(TILES.every(t => LOOKS[t.id])).toBe(true);
    const unique = (xs: string[]) => new Set(xs).size === xs.length;
    expect(unique(TILES.map(t => t.bg.toLowerCase()))).toBe(true);
    expect(unique(TILES.map(t => LOOKS[t.id].motif))).toBe(true);
    const panel = (id: string) => {
      const l = LOOKS[id];
      return l.controls.map(c => (c.kind === 'knob' ? `${c.style}${c.big ? '+' : ''}` : c.kind)).join(',') + '|' + l.footswitch;
    };
    expect(unique(TILES.map(t => panel(t.id)))).toBe(true);
  });
});
