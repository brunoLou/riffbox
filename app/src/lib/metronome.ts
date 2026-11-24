/** Web Audio metronome / drum machine with a look-ahead scheduler. */

export type Drum = 'accent' | 'beat' | 'sub' | 'kick' | 'snare' | 'ghost' | 'hat' | 'hatAcc';
/** Pitched notes for backing tracks: a bass note, or a chord (MIDI numbers), lasting `dur` seconds. */
export type Tone = { bass: number; dur: number } | { chord: number[]; dur: number; vol?: number };
export type Hit = Drum | Tone;
export interface Step { beat: number | null; bar?: number; hits: Hit[] }
export interface Pattern { steps: Step[]; stepDur: number }

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;

export class MetronomeEngine {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private timer: number | null = null;
  private next = 0;
  private i = 0;
  /** Bars scheduled since the start (1 = the first one). */
  private bars = 0;
  private mutedBar = false;

  /**
   * `hooks.onBar` is called as each new bar is scheduled (before it sounds: change the tempo there);
   * `hooks.muted` silences a whole bar (the beat lamps keep going).
   */
  constructor(private getPattern: () => Pattern, private onBeat: (beat: number, bar: number, count: number) => void,
    private hooks: { onBar?: (count: number) => void; muted?: (count: number) => boolean } = {}) {}

  /** Restart from the first step on the next tick (e.g. after changing the track). */
  rewind() { this.i = 0; }

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
    this.bars = 0;
    this.mutedBar = false;
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
      let p = this.getPattern();
      let step = p.steps[this.i % p.steps.length];
      if (step.beat === 0) {
        this.bars++;
        this.hooks.onBar?.(this.bars);
        this.mutedBar = this.hooks.muted?.(this.bars) ?? false;
        p = this.getPattern(); // the tempo may have just changed
        step = p.steps[this.i % p.steps.length];
      }
      if (!this.mutedBar) for (const h of step.hits) this.play(h, this.next);
      if (step.beat !== null) {
        const beat = step.beat, bar = step.bar ?? 0, count = this.bars;
        const delay = Math.max(0, (this.next - ctx.currentTime) * 1000);
        window.setTimeout(() => this.running && this.onBeat(beat, bar, count), delay);
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

  private tone(h: Tone, t: number) {
    const ctx = this.ctx!;
    const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);
    if ('bass' in h) {
      const o = ctx.createOscillator();
      o.type = 'triangle'; o.frequency.value = hz(h.bass);
      const o2 = ctx.createOscillator();
      o2.type = 'sawtooth'; o2.frequency.value = hz(h.bass);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 520;
      const g2 = ctx.createGain(); g2.gain.value = 0.35;
      o2.connect(g2); g2.connect(f); o.connect(f);
      f.connect(this.env(t, 0.5, Math.max(0.12, h.dur)));
      o.start(t); o2.start(t); o.stop(t + h.dur + 0.05); o2.stop(t + h.dur + 0.05);
      return;
    }
    const vol = h.vol ?? 0.1;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(2200, t);
    f.frequency.exponentialRampToValueAtTime(900, t + Math.max(0.1, h.dur));
    f.connect(this.env(t, vol, Math.max(0.1, h.dur)));
    for (const m of h.chord) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = hz(m);
      o.detune.value = (Math.random() - 0.5) * 8;
      o.connect(f);
      o.start(t); o.stop(t + h.dur + 0.05);
    }
  }

  private play(h: Hit, t: number) {
    const ctx = this.ctx!;
    if (typeof h !== 'string') return this.tone(h, t);
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

/* ---------- Trainer ---------- */

/** The tempo rises by `step` every `every` bars, up to `to`. */
export interface SpeedTrainer { on: boolean; step: number; every: number; to: number }
/** Bars played then bars left silent, again and again (to check one's own tempo). */
export interface GapTrainer { on: boolean; play: number; mute: number }
export const DEFAULT_SPEED: SpeedTrainer = { on: false, step: 4, every: 4, to: 140 };
export const DEFAULT_GAP: GapTrainer = { on: false, play: 2, mute: 2 };

/** Tempo of bar `bar` (1 = first) when the run started at `start`. */
export function trainerBpm(start: number, t: SpeedTrainer, bar: number): number {
  if (!t.on) return start;
  const top = Math.max(start, t.to);
  return Math.min(top, start + Math.floor((Math.max(1, bar) - 1) / Math.max(1, t.every)) * t.step);
}
/** Is bar `bar` (1 = first) a silent one? The first bars always sound. */
export function isSilentBar(g: GapTrainer, bar: number): boolean {
  if (!g.on || g.mute <= 0) return false;
  return (Math.max(1, bar) - 1) % (g.play + g.mute) >= g.play;
}
