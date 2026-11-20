/** Web Audio metronome / drum machine with a look-ahead scheduler. */

export type Hit = 'accent' | 'beat' | 'sub' | 'kick' | 'snare' | 'ghost' | 'hat' | 'hatAcc';
export interface Step { beat: number | null; hits: Hit[] }
export interface Pattern { steps: Step[]; stepDur: number }

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;

export class MetronomeEngine {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private timer: number | null = null;
  private next = 0;
  private i = 0;

  constructor(private getPattern: () => Pattern, private onBeat: (beat: number) => void) {}

  get running() { return this.timer !== null; }

  start() {
    if (this.running) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!this.ctx) this.ctx = new Ctx();
    void this.ctx.resume();
    if (!this.noise) {
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let k = 0; k < len; k++) d[k] = Math.random() * 2 - 1;
    }
    this.i = 0;
    this.next = this.ctx.currentTime + 0.06;
    this.timer = window.setInterval(() => this.tick(), LOOKAHEAD_MS);
    this.tick();
  }

  stop() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  dispose() {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
  }

  private tick() {
    const ctx = this.ctx!;
    while (this.next < ctx.currentTime + SCHEDULE_AHEAD) {
      const p = this.getPattern();
      const step = p.steps[this.i % p.steps.length];
      for (const h of step.hits) this.play(h, this.next);
      if (step.beat !== null) {
        const beat = step.beat;
        const delay = Math.max(0, (this.next - ctx.currentTime) * 1000);
        window.setTimeout(() => this.running && this.onBeat(beat), delay);
      }
      this.next += p.stepDur;
      this.i = (this.i + 1) % p.steps.length;
    }
  }

  private env(t: number, peak: number, decay: number) {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    g.connect(this.ctx!.destination);
    return g;
  }

  private blip(t: number, freq: number, peak: number) {
    const o = this.ctx!.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    o.connect(this.env(t, peak, 0.04));
    o.start(t); o.stop(t + 0.05);
  }

  private noiseHit(t: number, hp: number, peak: number, decay: number) {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx!.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = hp;
    s.connect(f); f.connect(this.env(t, peak, decay));
    s.start(t); s.stop(t + decay + 0.02);
  }

  private play(h: Hit, t: number) {
    const ctx = this.ctx!;
    switch (h) {
      case 'accent': return this.blip(t, 1760, 0.32);
      case 'beat': return this.blip(t, 1100, 0.22);
      case 'sub': return this.blip(t, 800, 0.08);
      case 'kick': {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        o.connect(this.env(t, 0.9, 0.32));
        o.start(t); o.stop(t + 0.34);
        return;
      }
      case 'snare':
      case 'ghost': {
        const peak = h === 'snare' ? 0.45 : 0.1;
        this.noiseHit(t, 1200, peak, 0.16);
        const o = ctx.createOscillator();
        o.type = 'triangle'; o.frequency.value = 185;
        o.connect(this.env(t, peak * 0.6, 0.08));
        o.start(t); o.stop(t + 0.1);
        return;
      }
      case 'hat': return this.noiseHit(t, 7000, 0.07, 0.04);
      case 'hatAcc': return this.noiseHit(t, 7000, 0.13, 0.06);
    }
  }
}

/* ---------- Patterns ---------- */

export const SIGNATURES = ['2/4', '3/4', '4/4', '5/4', '6/8'] as const;
export type Signature = (typeof SIGNATURES)[number];
export const beatsOf = (sig: Signature) => Number(sig.split('/')[0]);
export const defaultAccents = (sig: Signature) => Array.from({ length: beatsOf(sig) }, (_, i) => i === 0 || (sig === '6/8' && i === 3));

export const SUBDIVISIONS = [
  { n: 1, label: 'Noires' },
  { n: 2, label: 'Croches' },
  { n: 3, label: 'Triolets' },
  { n: 4, label: 'Doubles' },
];

export type GrooveId = 'clic' | 'shuffle' | 'rock' | 'funk';
interface GrooveDef { id: GrooveId; name: string; sub: string; steps: number; kick: number[]; snare: number[]; ghost: number[]; hat: number[]; hatAcc: number[] }

export const GROOVES: GrooveDef[] = [
  { id: 'clic', name: 'Clic', sub: 'Métronome', steps: 0, kick: [], snare: [], ghost: [], hat: [], hatAcc: [] },
  // Triplet grid: hats on the 1st and 3rd triplet of each beat.
  { id: 'shuffle', name: 'Shuffle', sub: 'Blues', steps: 12, kick: [0, 6, 8], snare: [3, 9], ghost: [], hat: [2, 5, 8, 11], hatAcc: [0, 3, 6, 9] },
  { id: 'rock', name: 'Rock', sub: 'Croches', steps: 8, kick: [0, 4, 5], snare: [2, 6], ghost: [], hat: [1, 3, 5, 7], hatAcc: [0, 2, 4, 6] },
  { id: 'funk', name: 'Funk', sub: '16e', steps: 16, kick: [0, 3, 10], snare: [4, 12], ghost: [7, 9, 14], hat: [1, 3, 5, 7, 9, 11, 13, 15], hatAcc: [0, 2, 4, 6, 8, 10, 12, 14] },
];

export function buildPattern(o: { bpm: number; sig: Signature; sub: number; accents: boolean[]; groove: GrooveId }): Pattern {
  const beatDur = 60 / o.bpm;
  const g = GROOVES.find(x => x.id === o.groove)!;
  if (g.steps) {
    const per = g.steps / 4;
    const steps: Step[] = Array.from({ length: g.steps }, (_, i) => {
      const hits: Hit[] = [];
      if (g.kick.includes(i)) hits.push('kick');
      if (g.snare.includes(i)) hits.push('snare');
      if (g.ghost.includes(i)) hits.push('ghost');
      if (g.hatAcc.includes(i)) hits.push('hatAcc');
      else if (g.hat.includes(i)) hits.push('hat');
      return { beat: i % per === 0 ? i / per : null, hits };
    });
    return { steps, stepDur: beatDur / per };
  }
  if (o.sig === '6/8') {
    // Tempo is the dotted quarter; each eighth is a beat lamp.
    const steps = o.accents.map((a, b): Step => ({ beat: b, hits: [a ? 'accent' : 'beat'] }));
    return { steps, stepDur: beatDur / 3 };
  }
  const steps: Step[] = [];
  o.accents.forEach((a, b) => {
    for (let s = 0; s < o.sub; s++) steps.push(s === 0 ? { beat: b, hits: [a ? 'accent' : 'beat'] } : { beat: null, hits: ['sub'] });
  });
  return { steps, stepDur: beatDur / o.sub };
}
