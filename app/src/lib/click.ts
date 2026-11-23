/** A plain metronome click on an AudioContext, scheduled ahead (for the coach's tests). */
export class Clicker {
  readonly ac: AudioContext;
  private timer: number | null = null;
  private next = 0;
  private n = 0;
  /** Audio-clock times of the clicks played so far. */
  readonly times: number[] = [];
  constructor(ac?: AudioContext) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ac = ac ?? new Ctx({ latencyHint: 'interactive' });
  }
  /** Clicks at `bpm` from `at` (audio time), accent every `beats`. */
  start(bpm: number, beats = 4, at = this.ac.currentTime + 0.15) {
    void this.ac.resume();
    this.stop();
    this.next = at; this.n = 0;
    const tick = () => {
      while (this.next < this.ac.currentTime + 0.12) {
        this.beep(this.next, this.n % beats === 0);
        this.times.push(this.next);
        this.next += 60 / bpm; this.n++;
      }
    };
    tick();
    this.timer = window.setInterval(tick, 25);
    return at;
  }
  private beep(at: number, accent: boolean) {
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.frequency.value = accent ? 1760 : 1320;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.5, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    o.connect(g); g.connect(this.ac.destination); o.start(at); o.stop(at + 0.06);
  }
  stop() { if (this.timer !== null) clearInterval(this.timer); this.timer = null; }
  dispose() { this.stop(); void this.ac.close(); }
}
