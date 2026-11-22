import { describe, expect, it } from 'vitest';
import { chroma, parseChordName, rankChords, songChords, type ChordShape } from '../../src/lib/chordDetect';
import { OPEN_MIDI, chordType, voicingMidi, voicings } from '../../src/lib/chords';
import { SONG } from '../../src/lib/data';

const SR = 48000, N = 8192;

/** Magnitude spectrum (Hann window), radix-2 FFT. */
function spectrum(x: Float32Array): Float32Array {
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = x[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= N; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < N; i += len) for (let k = 0; k < len / 2; k++) {
      const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
      const ur = re[i + k], ui = im[i + k];
      const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi, vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
      re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
    }
  }
  const out = new Float32Array(N / 2);
  for (let i = 0; i < N / 2; i++) out[i] = Math.hypot(re[i], im[i]) / N;
  return out;
}

/** A strummed chord: strings low to high 15 ms apart, harmonics, slight detune, decay, noise. */
function strum(midis: number[], seed = 1, at = 0.35): Float32Array {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const x = new Float32Array(N);
  const strings = midis.map((m, i) => ({ f: 440 * 2 ** ((m - 69) / 12 + (rnd() - 0.5) * 0.012), t0: i * 0.015, amp: 0.6 + rnd() * 0.5 }));
  for (let n = 0; n < N; n++) {
    const t = at + n / SR;
    let v = 0;
    for (const st of strings) {
      const dt = t - st.t0;
      if (dt < 0) continue;
      for (let k = 1; k <= 8; k++) v += (st.amp / k ** 1.3) * Math.exp(-dt * (1.2 + k * 0.4)) * Math.sin(2 * Math.PI * st.f * k * dt);
    }
    x[n] = v * 0.15 + (rnd() - 0.5) * 0.02;
  }
  return x;
}

const shape = (n: string) => parseChordName(n)!;
const detect = (midis: number[], cands: ChordShape[], seed?: number) => rankChords(chroma(spectrum(strum(midis, seed)), SR, N), cands);
const notesOf = (name: string, i = 0) => {
  const s = shape(name);
  const typeId = /maj7/.test(name) ? 'maj7' : /m7/.test(name) ? 'm7' : /7/.test(name) ? '7' : /m/.test(name) ? 'm' : 'maj';
  return voicingMidi(voicings(s.root, chordType(typeId))[i]);
};

describe('chord names', () => {
  it('reads roots, qualities and bass notes', () => {
    expect(shape('A7')).toMatchObject({ root: 9, pcs: [9, 1, 4, 7], bass: 9 });
    expect(shape('F#m')).toMatchObject({ root: 6, pcs: [6, 9, 1] });
    expect(shape('Bbmaj7').pcs).toEqual([10, 2, 5, 9]);
    expect(shape('C/G')).toMatchObject({ root: 0, bass: 7 });
    expect(shape('Amin').pcs).toEqual([9, 0, 4]);
    expect(shape('E7#9').pcs).toEqual([4, 8, 11, 2]);
    expect(parseChordName('N.C.')).toBeNull();
  });
  it('lists the chords of a song once each, in order', () => {
    expect(songChords(SONG).map(c => c.name)).toEqual(['A7', 'D7', 'E7', 'F#m', 'D']);
  });
});

describe('recognising a strummed chord among the song’s chords', () => {
  const minuit = songChords(SONG);
  for (const name of ['A7', 'D7', 'E7', 'F#m', 'D']) {
    it(`${name}, in several positions and strums`, () => {
      for (let pos = 0; pos < 2; pos++) for (let seed = 1; seed <= 4; seed++) {
        const r = detect(notesOf(name, pos), minuit, seed * 7 + pos);
        expect(r[0].name, `${name} position ${pos + 1}, grattage ${seed}`).toBe(name);
      }
    });
  }

  it('common open chords in a typical song (C, G, Am, F, Em, Dm)', () => {
    const cands = ['C', 'G', 'Am', 'F', 'Em', 'Dm'].map(shape);
    for (const name of ['C', 'G', 'Am', 'F', 'Em', 'Dm']) {
      for (let seed = 1; seed <= 3; seed++) expect(detect(notesOf(name), cands, seed)[0].name, `${name} ${seed}`).toBe(name);
    }
  });

  it('a clear winner: the best score stands out from the second', () => {
    const r = detect(notesOf('D7'), minuit, 3);
    expect(r[0].score - r[1].score).toBeGreaterThan(0.08);
  });

  it('silence and noise give no energy to speak of', () => {
    const quiet = new Float32Array(N).map((_, i) => Math.sin(i) * 1e-5);
    expect(chroma(spectrum(quiet), SR, N).energy).toBeLessThan(1e-8);
  });

  it('the open strings alone are not a chord of the song', () => {
    const r = detect(OPEN_MIDI, minuit, 2);
    expect(r[0].score).toBeLessThan(0.9);
  });
});
