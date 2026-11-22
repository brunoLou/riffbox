/**
 * Key of a piece, by ear: the notes heard over 15–30 s, compared with the profile of each of the
 * 24 keys (Krumhansl–Kessler: how strongly each degree belongs to a major or minor key).
 */
import { chroma } from './chordDetect';
import { KEY_FR, mod12 } from './music';

const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export interface KeyGuess { key: number; minor: boolean; score: number }

function pearson(a: number[], b: number[]) {
  const ma = a.reduce((s, x) => s + x, 0) / a.length, mb = b.reduce((s, x) => s + x, 0) / b.length;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/** The 24 keys, most likely first (correlation from −1 to 1). */
export function rankKeys(c: number[]): KeyGuess[] {
  const out: KeyGuess[] = [];
  for (let k = 0; k < 12; k++) {
    const rot = (p: number[]) => c.map((_, i) => p[mod12(i - k)]);
    out.push({ key: k, minor: false, score: pearson(c, rot(MAJOR)) });
    out.push({ key: k, minor: true, score: pearson(c, rot(MINOR)) });
  }
  return out.sort((x, y) => y.score - x.score);
}

export const keyLabel = (g: Pick<KeyGuess, 'key' | 'minor'>) => `${KEY_FR[g.key]} ${g.minor ? 'mineur' : 'majeur'}`;
/** The other key with the same notes (La majeur ⇄ Fa♯ mineur). */
export const relativeOf = (g: Pick<KeyGuess, 'key' | 'minor'>) => ({ key: mod12(g.key + (g.minor ? 3 : -3)), minor: !g.minor });

export type Confidence = 'sure' | 'likely' | 'unsure';
export const CONFIDENCE_FR: Record<Confidence, string> = { sure: 'très probable', likely: 'probable', unsure: 'incertain' };

/**
 * Notes heard so far, summed over time (louder moments count more), and the verdict.
 * Feed it spectra; frames that are too quiet are ignored.
 */
export class KeyListener {
  private sum = new Array(12).fill(0);
  /** How long each note was heard in the bass: the home note usually comes back there most. */
  private bass = new Array(12).fill(0);
  /** Seconds of actual music heard. */
  heard = 0;

  add(mags: ArrayLike<number>, sampleRate: number, fftSize: number, rms: number, frameSeconds = 0.1) {
    if (rms < 0.008) return;
    const { c, energy, bass } = chroma(mags, sampleRate, fftSize);
    if (!energy) return;
    if (bass !== null) this.bass[bass] += frameSeconds;
    // Square-root weighting: loud chords count more, without drowning quiet passages.
    const w = Math.sqrt(rms);
    c.forEach((x, i) => (this.sum[i] += x * w));
    this.heard += frameSeconds;
  }

  /** Share of each note in what was heard (sums to 1). */
  get notes(): number[] {
    const t = this.sum.reduce((s, x) => s + x, 0);
    return t ? this.sum.map(x => x / t) : this.sum.slice();
  }

  /** Best guesses and how sure; null until a few seconds of music were heard. */
  verdict(minSeconds = 4): { best: KeyGuess; others: KeyGuess[]; confidence: Confidence; relativeClose: boolean } | null {
    if (this.heard < minSeconds) return null;
    const ranked = rankKeys(this.notes);
    let [best] = ranked;
    let rel = relativeOf(best);
    let relGuess = ranked.find(g => g.key === rel.key && g.minor === rel.minor)!;
    // Major and its relative minor share their notes; the bass tells which one is home.
    const bassOf = (g: KeyGuess) => this.bass[g.key];
    const bassSays = bassOf(relGuess) >= 1.5 * bassOf(best) && bassOf(relGuess) > 0 && best.score - relGuess.score < 0.2;
    if (bassSays) [best, relGuess] = [relGuess, best];
    rel = relativeOf(best);
    // When the bass decided between two relatives, their scores say nothing about certainty.
    const margin = bassSays ? 0.05 : best.score - ranked.find(g => g !== best)!.score;
    const confidence: Confidence = this.heard >= 12 && best.score > 0.75 && margin > 0.08 ? 'sure'
      : best.score > 0.6 && margin > 0.03 ? 'likely' : 'unsure';
    return {
      best,
      others: ranked.filter(g => g !== best).slice(0, 3),
      confidence,
      // Both possible: close scores, and a bass that does not clearly point to one of them.
      relativeClose: !bassSays && (best.score - relGuess.score < 0.12 || bassOf(relGuess) >= 0.8 * bassOf(best)),
    };
  }

  reset() { this.sum.fill(0); this.bass.fill(0); this.heard = 0; }
}
