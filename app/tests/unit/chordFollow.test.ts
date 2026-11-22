import { describe, expect, it } from 'vitest';
import { ChordFollower, followEvents } from '../../src/lib/chordFollow';
import { SONG } from '../../src/lib/data';
import { parseChordPro } from '../../src/lib/music';

const events = followEvents(parseChordPro(SONG, 0));
/** Hear `chord` held for `ms`, sampled every 100 ms, starting at `t`. Returns the end time. */
const hold = (f: ChordFollower, chord: string | null, t: number, ms = 600) => { for (let x = t; x <= t + ms; x += 100) f.hear(chord, x); return t + ms + 100; };

describe('chords of the song', () => {
  it('in reading order, with their line', () => {
    expect(events.slice(0, 6).map(e => e.chord)).toEqual(['A7', 'D7', 'A7', 'A7', 'D7', 'A7']);
    expect(events[0].line).toBe(1); // line 0 is « Couplet 1 »
    expect(events[2].line).toBe(2);
  });
});

describe('following the player', () => {
  it('moves forward chord by chord, skipping a repeated chord', () => {
    const f = new ChordFollower(events);
    let t = 0;
    t = hold(f, 'A7', t); expect(f.pos).toBe(0);
    t = hold(f, 'D7', t); expect(f.pos).toBe(1);
    t = hold(f, 'A7', t); expect(f.pos).toBe(2);
    // The next written chords are A7 (same) then D7: playing D7 passes the repeat.
    t = hold(f, 'D7', t); expect(f.pos).toBe(4);
    expect(events[f.pos].line).toBe(3);
  });

  it('a chord heard for too short a time does not count', () => {
    const f = new ChordFollower(events);
    f.hear('D7', 0); f.hear('D7', 200);
    expect(f.pos).toBe(0);
    f.hear('D7', 400);
    expect(f.pos).toBe(1);
  });

  it('a stray chord far ahead, or one already passed, does not move it', () => {
    const f = new ChordFollower(events);
    let t = hold(f, 'F#m', 0); // only in the bridge, far away
    expect(f.pos).toBe(0);
    t = hold(f, 'D7', t); t = hold(f, 'A7', t); // pos 2
    t = hold(f, 'nope', t);
    expect(f.pos).toBe(2);
  });

  it('silence between strums keeps the place, and the same chord again does not move it', () => {
    const f = new ChordFollower(events);
    let t = hold(f, 'D7', 0);
    t = hold(f, null, t);
    t = hold(f, 'D7', t);
    expect(f.pos).toBe(1);
  });

  it('plays the whole song through, to the last chord', () => {
    const f = new ChordFollower(events);
    let t = 0;
    for (const e of events) t = hold(f, e.chord, t);
    expect(f.pos).toBe(events.length - 1);
  });

  it('after a manual page turn, follows from there', () => {
    const f = new ChordFollower(events);
    const bridge = events.findIndex(e => e.chord === 'F#m');
    f.resync(bridge);
    expect(f.next?.chord).toBe('D');
    hold(f, 'D', 0);
    expect(f.current?.chord).toBe('D');
  });
});
