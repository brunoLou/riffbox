import { GROOVES, type GrooveId, type Hit, type Pattern, type Step } from './metronome';
import { KEY_FR, mod12 } from './music';

export type Quality = '7' | 'm7' | '9' | '5' | 'maj' | 'm';
export interface BarChord { deg: number; q: Quality }
export interface Track {
  id: string; name: string; style: string; groove: Exclude<GrooveId, 'clic'>;
  key: number; minor?: boolean; bpm: number; form: string; bars: BarChord[];
}

const I7 = { deg: 0, q: '7' } as const, IV7 = { deg: 5, q: '7' } as const, V7 = { deg: 7, q: '7' } as const;
const TWELVE_BAR: BarChord[] = [I7, IV7, I7, I7, IV7, IV7, I7, I7, V7, IV7, I7, V7];

export const TRACKS: Track[] = [
  { id: 'b1', name: 'Blues en La', style: 'Blues', groove: 'shuffle', key: 9, bpm: 90, form: '12 mesures · shuffle', bars: TWELVE_BAR },
  { id: 'b2', name: 'Blues en Sol', style: 'Blues', groove: 'shuffle', key: 7, bpm: 112, form: '12 mesures · shuffle rapide', bars: TWELVE_BAR },
  { id: 'b3', name: 'Blues lent en Mi', style: 'Blues', groove: 'shuffle', key: 4, bpm: 66, form: '12 mesures · lent', bars: TWELVE_BAR },
  { id: 'r1', name: 'Rock en Mi', style: 'Rock', groove: 'rock', key: 4, bpm: 120, form: 'I · ♭VII · IV · I',
    bars: [{ deg: 0, q: '5' }, { deg: 10, q: '5' }, { deg: 5, q: '5' }, { deg: 0, q: '5' }] },
  { id: 'r2', name: 'Rock en Sol', style: 'Rock', groove: 'rock', key: 7, bpm: 132, form: 'I · IV · V · IV',
    bars: [{ deg: 0, q: '5' }, { deg: 5, q: '5' }, { deg: 7, q: '5' }, { deg: 5, q: '5' }] },
  { id: 'f1', name: 'Funk en Mi m', style: 'Funk', groove: 'funk', key: 4, minor: true, bpm: 100, form: 'i7 · IV9 · vamp',
    bars: [{ deg: 0, q: 'm7' }, { deg: 0, q: 'm7' }, { deg: 5, q: '9' }, { deg: 0, q: 'm7' }] },
  { id: 'f2', name: 'Funk en La m', style: 'Funk', groove: 'funk', key: 9, minor: true, bpm: 96, form: 'i7 · IV9',
    bars: [{ deg: 0, q: 'm7' }, { deg: 5, q: '9' }] },
];

export const BPM_RANGE = [50, 180] as const;

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const SUFFIX: Record<Quality, string> = { '7': '7', m7: 'm7', '9': '9', '5': '5', maj: '', m: 'm' };
const VOICING: Record<Quality, number[]> = { '7': [0, 4, 10], m7: [0, 3, 7, 10], '9': [0, 4, 10, 14], '5': [0, 7, 12], maj: [0, 4, 7], m: [0, 3, 7] };

export const chordLabel = (key: number, c: BarChord) => NAMES[mod12(key + c.deg)] + SUFFIX[c.q];
export const trackKey = (key: number, minor?: boolean) => KEY_FR[mod12(key)] + (minor ? ' m' : '');

/** One full pass of the form as a step pattern (drums + bass + chords). */
export function buildBacking(t: Track, key: number, bpm: number): Pattern {
  const g = GROOVES.find(x => x.id === t.groove)!;
  const per = g.steps / 4;
  const beat = 60 / bpm, step = beat / per;
  const steps: Step[] = [];
  t.bars.forEach((c, b) => {
    const pc = mod12(key + c.deg);
    const root = 40 + mod12(pc - 4);
    const chord = VOICING[c.q].map(i => 52 + mod12(pc - 4) + i);
    for (let i = 0; i < g.steps; i++) {
      const hits: Hit[] = [];
      if (g.kick.includes(i)) hits.push('kick');
      if (g.snare.includes(i)) hits.push('snare');
      if (g.ghost.includes(i)) hits.push('ghost');
      if (g.hatAcc.includes(i)) hits.push('hatAcc'); else if (g.hat.includes(i)) hits.push('hat');

      if (t.groove === 'shuffle') {
        // Boogie bass: R 3 5 6 on the beats, repeated on the shuffled off-beat.
        const walk = [0, 4, 7, 9][Math.floor(i / per)];
        if (i % per === 0) hits.push({ bass: root + walk, dur: beat * 0.6 });
        if (i % per === 2) hits.push({ bass: root + walk, dur: step * 0.9 });
        if (i === per || i === per * 3) hits.push({ chord, dur: beat * 0.3, vol: 0.09 });
      } else if (t.groove === 'rock') {
        hits.push({ bass: root, dur: step * 0.85 });
        if (i === 0) hits.push({ chord, dur: beat * 3.8, vol: 0.05 });
      } else {
        const bass: Record<number, number> = { 0: 0, 3: 12, 6: 0, 8: 0, 10: 12, 14: 10 };
        if (i in bass) hits.push({ bass: root + bass[i], dur: step * 0.8 });
        if ([2, 5, 7, 11, 13].includes(i)) hits.push({ chord, dur: 0.09, vol: 0.08 });
      }
      steps.push({ beat: i % per === 0 ? i / per : null, bar: b, hits });
    }
  });
  return { steps, stepDur: step };
}
