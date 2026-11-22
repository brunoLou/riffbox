/**
 * Looper audio engine: the microphone captured sample by sample (AudioWorklet, or a
 * ScriptProcessor where worklets are missing), a loop clock, a click, layers played in a loop.
 * Everything is timed on the audio clock; the latency compensation shifts what is recorded.
 */
import { Capture, captureStart, loopFrames, loopPhase, loopSeconds, measureLatency, nextLoopStart, type Chunk, type LoopSettings } from './loop';

export interface Layer { id: number; data: Float32Array; gain: number; muted: boolean }
export type LooperState =
  | { kind: 'idle' }
  | { kind: 'playing' }
  | { kind: 'countin'; until: number }
  | { kind: 'armed'; at: number }
  | { kind: 'recording'; from: number };

const WORKLET = `
class RiffboxCapture extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage({ frame: currentFrame, data: ch.slice(0) });
    return true;
  }
}
registerProcessor('riffbox-capture', RiffboxCapture);`;

export class LooperEngine {
  readonly ac: AudioContext;
  layers: Layer[] = [];
  state: LooperState = { kind: 'idle' };
  settings: LoopSettings;
  click = true;
  /** Seconds between a sound leaving the speaker and coming back through the microphone. */
  latency = 0.12;
  /** Audio-clock time of a loop start (all loop starts are t0 + k·length). */
  t0 = 0;

  private master: GainNode;
  private clickBus: GainNode;
  private gains = new Map<number, GainNode>();
  private sources = new Map<number, AudioBufferSourceNode>();
  private stream: MediaStream | null = null;
  private input: AudioNode | null = null;
  private capture: Capture | null = null;
  private listeners = new Set<(c: Chunk) => void>();
  private timer: number | null = null;
  private nextBeat = 0;
  private beatIndex = 0;
  private nextId = 1;
  /** Called on every change of state or layers. */
  onChange: () => void = () => {};

  constructor(settings: LoopSettings) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ac = new Ctx({ latencyHint: 'interactive' });
    this.settings = settings;
    this.master = this.ac.createGain();
    this.master.connect(this.ac.destination);
    this.clickBus = this.ac.createGain();
    this.clickBus.gain.value = 0.5;
    this.clickBus.connect(this.ac.destination);
  }

  get length() { return loopSeconds(this.settings); }
  get frames() { return loopFrames(this.settings, this.ac.sampleRate); }
  get sampleRate() { return this.ac.sampleRate; }
  get running() { return this.state.kind !== 'idle'; }
  /** A first guess at the latency from what the browser reports. */
  guessLatency() {
    const a = this.ac as AudioContext & { outputLatency?: number };
    const inLat = (this.stream?.getAudioTracks()[0]?.getSettings() as { latency?: number } | undefined)?.latency ?? 0.01;
    return Math.min(0.4, (a.baseLatency ?? 0.01) + (a.outputLatency ?? 0.02) + inLat);
  }

  /* ---------- Microphone ---------- */

  async openMic() {
    if (this.input) return;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const src = this.ac.createMediaStreamSource(this.stream);
    const sink = this.ac.createGain();
    sink.gain.value = 0; // keeps the capture node running, silently
    sink.connect(this.ac.destination);
    const emit = (c: Chunk) => { this.capture?.add(c); this.listeners.forEach(l => l(c)); if (this.capture?.done) this.finishLayer(); };
    try {
      const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
      await this.ac.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      const node = new AudioWorkletNode(this.ac, 'riffbox-capture', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' });
      node.port.onmessage = e => emit(e.data as Chunk);
      src.connect(node); node.connect(sink);
      this.input = node;
    } catch {
      const sp = this.ac.createScriptProcessor(1024, 1, 1);
      sp.onaudioprocess = e => emit({ frame: Math.round(e.playbackTime * this.ac.sampleRate), data: e.inputBuffer.getChannelData(0).slice(0) });
      src.connect(sp); sp.connect(sink);
      this.input = sp;
    }
  }

  closeMic() {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.input?.disconnect();
    this.input = null;
  }

  /* ---------- Transport ---------- */

  private startClock(t0: number) {
    this.t0 = t0;
    const beat = 60 / this.settings.bpm;
    // The count-in bar (if any) is part of the clock: beats run from the first click.
    const firstBeat = this.state.kind === 'countin' ? t0 - this.settings.beats * beat : t0;
    this.nextBeat = firstBeat;
    this.beatIndex = 0;
    if (this.timer === null) this.timer = window.setInterval(() => this.tick(), 25);
    this.tick();
  }

  private tick() {
    const beat = 60 / this.settings.bpm;
    while (this.nextBeat < this.ac.currentTime + 0.12) {
      const counting = this.state.kind === 'countin' && this.nextBeat < this.t0 - 1e-6;
      if (this.click || counting) this.beep(this.nextBeat, this.beatIndex % this.settings.beats === 0, counting);
      this.nextBeat += beat;
      this.beatIndex++;
    }
    const now = this.ac.currentTime;
    const s = this.state;
    if (s.kind === 'countin' && now >= s.until) { this.state = { kind: 'recording', from: s.until }; this.onChange(); }
    if (s.kind === 'armed' && now >= s.at) { this.state = { kind: 'recording', from: s.at }; this.onChange(); }
  }

  private beep(at: number, accent: boolean, loud: boolean) {
    const o = this.ac.createOscillator();
    const g = this.ac.createGain();
    o.frequency.value = accent ? 1760 : 1320;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(loud ? 0.8 : 0.45, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.05);
    o.connect(g); g.connect(this.clickBus);
    o.start(at); o.stop(at + 0.06);
  }

  /** Plays every layer from the start of the loop. */
  play() {
    if (this.running || !this.layers.length) return;
    this.state = { kind: 'playing' };
    this.startClock(this.ac.currentTime + 0.08);
    this.layers.forEach(l => this.startLayer(l, this.t0));
    this.onChange();
  }

  stop() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.sources.forEach(s => { try { s.stop(); } catch { /* already stopped */ } });
    this.sources.clear();
    this.capture = null;
    this.state = { kind: 'idle' };
    this.onChange();
  }

  /**
   * Records a new layer: after a one-bar count-in when stopped, else from the next loop start.
   * Exactly one loop long; it plays at once when done.
   */
  async record() {
    await this.openMic();
    void this.ac.resume();
    const now = this.ac.currentTime;
    let from: number;
    if (!this.running) {
      from = now + 0.1 + this.settings.beats * (60 / this.settings.bpm);
      this.state = { kind: 'countin', until: from };
      this.startClock(from);
      this.layers.forEach(l => this.startLayer(l, from));
    } else {
      from = nextLoopStart(this.t0, this.length, now + 0.05);
      this.state = { kind: 'armed', at: from };
    }
    this.capture = new Capture(captureStart(from, this.latency, this.sampleRate), this.frames);
    this.onChange();
  }

  /** Drops the layer being recorded (the loop keeps playing, or stops if it was the first). */
  cancelRecording() {
    this.capture = null;
    if (!this.layers.length) { this.stop(); return; }
    this.state = { kind: 'playing' };
    this.onChange();
  }

  private finishLayer() {
    const c = this.capture!;
    this.capture = null;
    const layer: Layer = { id: this.nextId++, data: c.out, gain: 0.9, muted: false };
    this.layers.push(layer);
    this.state = { kind: 'playing' };
    const t = this.ac.currentTime + 0.03;
    this.startLayer(layer, t);
    this.onChange();
  }

  private startLayer(l: Layer, at: number) {
    const buf = this.ac.createBuffer(1, l.data.length, this.sampleRate);
    buf.getChannelData(0).set(l.data);
    const src = this.ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    let g = this.gains.get(l.id);
    if (!g) { g = this.ac.createGain(); g.connect(this.master); this.gains.set(l.id, g); }
    g.gain.value = l.muted ? 0 : l.gain;
    src.connect(g);
    // Joins the loop where it is: at its start, or mid-way at the right offset.
    src.start(at, at >= this.t0 ? loopPhase(this.t0, this.length, at) : 0);
    this.sources.get(l.id)?.stop();
    this.sources.set(l.id, src);
  }

  setGain(id: number, gain: number, muted: boolean) {
    const l = this.layers.find(x => x.id === id);
    if (!l) return;
    l.gain = gain; l.muted = muted;
    const g = this.gains.get(id);
    if (g) g.gain.setTargetAtTime(muted ? 0 : gain, this.ac.currentTime, 0.02);
    this.onChange();
  }

  removeLayer(id: number) {
    try { this.sources.get(id)?.stop(); } catch { /* not started */ }
    this.sources.delete(id);
    this.gains.get(id)?.disconnect();
    this.gains.delete(id);
    this.layers = this.layers.filter(l => l.id !== id);
    if (!this.layers.length && this.state.kind === 'playing') this.stop();
    this.onChange();
  }

  clear() { this.stop(); [...this.layers].forEach(l => this.removeLayer(l.id)); }

  /** Where the loop is (0–1) and the beat (from 0), for the display. */
  position(): { phase: number; beat: number; bar: number; countin: number | null } {
    const now = this.ac.currentTime;
    const beat = 60 / this.settings.bpm;
    if (this.state.kind === 'countin') {
      const left = Math.max(0, Math.ceil((this.state.until - now) / beat));
      return { phase: 0, beat: 0, bar: 0, countin: left };
    }
    if (!this.running || now < this.t0) return { phase: 0, beat: 0, bar: 0, countin: null };
    const p = loopPhase(this.t0, this.length, now);
    const b = Math.floor(p / beat);
    return { phase: p / this.length, beat: b % this.settings.beats, bar: Math.floor(b / this.settings.beats), countin: null };
  }

  /**
   * Measures the latency: eight beeps through the speaker, heard back by the microphone.
   * Needs the speaker on (no headphones). Returns seconds, or null when the beeps were not heard.
   */
  async measure(): Promise<number | null> {
    await this.openMic();
    void this.ac.resume();
    const sr = this.sampleRate;
    const start = this.ac.currentTime + 0.3;
    const times = Array.from({ length: 8 }, (_, i) => start + i * 0.6);
    const capture = new Capture(Math.round((start - 0.1) * sr), Math.round((8 * 0.6 + 0.2) * sr));
    const done = new Promise<void>(resolve => {
      const l = (c: Chunk) => { capture.add(c); if (capture.done) { this.listeners.delete(l); resolve(); } };
      this.listeners.add(l);
    });
    times.forEach(t => this.beep(t, true, true));
    await Promise.race([done, new Promise(r => setTimeout(r, 8000))]);
    return measureLatency(capture.out, capture.start, times.map(t => Math.round(t * sr)), sr);
  }

  dispose() { this.stop(); this.closeMic(); void this.ac.close(); }
}
