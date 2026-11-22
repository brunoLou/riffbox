import { describe, expect, it } from 'vitest';
import { encodeWav, sameChannels } from '../../src/lib/wav';
import { crc32, makeZip } from '../../src/lib/zip';

const bytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());
const str = (u: Uint8Array, at: number, n = 4) => String.fromCharCode(...u.slice(at, at + n));

describe('WAV for music programs', () => {
  it('24-bit PCM with the right sizes, full scale kept, title and tempo inside', async () => {
    const sine = Float32Array.from({ length: 4800 }, (_, i) => Math.sin((2 * Math.PI * 440 * i) / 48000));
    sine[0] = 1; sine[1] = -1; sine[2] = 2; // clipped
    const u = await bytes(encodeWav([sine], 48000, { title: 'Riff', bpm: 120, root: 9, comment: 'La majeur' }));
    const v = new DataView(u.buffer);
    expect(str(u, 0)).toBe('RIFF'); expect(str(u, 8)).toBe('WAVE');
    expect(v.getUint32(4, true)).toBe(u.length - 8);
    const chunks: Record<string, number> = {};
    for (let i = 12; i < u.length;) { const size = v.getUint32(i + 4, true); chunks[str(u, i)] = i + 8; i += 8 + size + (size & 1); }
    expect(Object.keys(chunks)).toEqual(['fmt ', 'acid', 'LIST', 'data']);
    const f = chunks['fmt '];
    expect([v.getUint16(f, true), v.getUint16(f + 2, true), v.getUint32(f + 4, true), v.getUint16(f + 14, true)]).toEqual([1, 1, 48000, 24]);
    const a = chunks.acid;
    expect([v.getUint16(a + 4, true), v.getUint32(a + 12, true), v.getFloat32(a + 20, true)]).toEqual([69, 1, 120]); // root A, at least one beat, 120 BPM
    const d = chunks.data;
    expect(v.getUint32(d - 4, true)).toBe(4800 * 3);
    const s24 = (k: number) => (u[d + 3 * k] | (u[d + 3 * k + 1] << 8) | (u[d + 3 * k + 2] << 16)) << 8 >> 8;
    expect([s24(0), s24(1), s24(2)]).toEqual([0x7fffff, -0x800000, 0x7fffff]);
  });
  it('no tempo nor key: no acid chunk', async () => {
    const u = await bytes(encodeWav([new Float32Array(10)], 44100));
    expect(new TextDecoder('latin1').decode(u)).not.toContain('acid');
  });
  it('two identical channels are one (a microphone), real stereo stays stereo', () => {
    const a = Float32Array.from({ length: 100 }, (_, i) => Math.sin(i));
    expect(sameChannels([a, a.slice()])).toBe(true);
    expect(sameChannels([a, a.map(x => x * 0.5)])).toBe(false);
    expect(sameChannels([a])).toBe(false);
  });
});

describe('ZIP', () => {
  it('CRC-32 of the standard check string', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
  it('local headers, central directory and end record agree; names in UTF-8', async () => {
    const enc = new TextEncoder();
    const u = await bytes(makeZip([{ name: 'Carnet/Ré mineur.wav', data: enc.encode('abc') }, { name: 'index.csv', data: enc.encode('x;y') }]));
    const v = new DataView(u.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint16(6, true) & 0x0800).toBe(0x0800);
    const end = u.length - 22;
    expect(v.getUint32(end, true)).toBe(0x06054b50);
    expect(v.getUint16(end + 10, true)).toBe(2);
    const cd = v.getUint32(end + 16, true);
    expect(v.getUint32(cd, true)).toBe(0x02014b50);
    expect(new TextDecoder().decode(u.slice(cd + 46, cd + 46 + v.getUint16(cd + 28, true)))).toBe('Carnet/Ré mineur.wav');
    expect(v.getUint32(cd + 16, true)).toBe(crc32(enc.encode('abc')));
  });
});
