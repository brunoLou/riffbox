import { describe, expect, it } from 'vitest';
import { actionForMidi, assignMidi, isPress, midiLabel, midiSig, parseMidi } from '../../src/lib/midiPedal';

describe('MIDI pedals', () => {
  it('reads notes, control changes and program changes; ignores the rest', () => {
    expect(parseMidi([0x90, 60, 100])).toEqual({ kind: 'note', ch: 1, num: 60, value: 100 });
    expect(parseMidi([0x80, 60, 0])).toMatchObject({ kind: 'note', value: 0 });
    expect(parseMidi([0xb2, 64, 127])).toEqual({ kind: 'cc', ch: 3, num: 64, value: 127 });
    expect(parseMidi([0xc0, 5])).toMatchObject({ kind: 'pc', num: 5 });
    expect(parseMidi([0xf8])).toBeNull(); // clock
  });
  it('a press counts, not the release', () => {
    expect(isPress(parseMidi([0xb0, 64, 127])!)).toBe(true);
    expect(isPress(parseMidi([0xb0, 64, 0])!)).toBe(false);
    expect(isPress(parseMidi([0x90, 60, 0])!)).toBe(false); // note on at 0 = off
    expect(isPress(parseMidi([0xc0, 1])!)).toBe(true);
  });
  it('footswitches taught to pedals, one footswitch per pedal', () => {
    let map = assignMidi({}, 'right', 'cc:1:64');
    map = assignMidi(map, 'left', 'cc:1:65');
    expect(actionForMidi(map, parseMidi([0xb0, 65, 127])!)).toBe('left');
    map = assignMidi(map, 'middle', 'cc:1:64'); // moved from the right pedal
    expect(map).toEqual({ left: 'cc:1:65', middle: 'cc:1:64' });
    expect(actionForMidi(map, parseMidi([0xb1, 64, 127])!)).toBeNull(); // other channel
    expect(midiSig(parseMidi([0x90, 60, 90])!)).toBe('note:1:60');
    expect(midiLabel('cc:2:64')).toBe('CC 64 · canal 2');
  });
});
