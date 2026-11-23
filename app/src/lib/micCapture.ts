/**
 * The microphone sample by sample, on the audio clock of `ac` (AudioWorklet, or a
 * ScriptProcessor where worklets are missing). Raw sound: no echo cancelling nor automatic gain.
 */
const WORKLET = `
class RiffboxTap extends AudioWorkletProcessor {
  process(inputs) { const ch = inputs[0] && inputs[0][0]; if (ch) this.port.postMessage({ frame: currentFrame, data: ch.slice(0) }); return true; }
}
registerProcessor('riffbox-tap', RiffboxTap);`;

export interface MicCapture {
  /** Samples between two audio times (seconds), as far as they arrived. */
  between(from: number, to: number): Float32Array;
  stop(): void;
}

export async function captureMic(ac: AudioContext): Promise<MicCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  const src = ac.createMediaStreamSource(stream);
  const sink = ac.createGain();
  sink.gain.value = 0;
  sink.connect(ac.destination);
  const chunks: { frame: number; data: Float32Array }[] = [];
  const keep = (frame: number, data: Float32Array) => {
    chunks.push({ frame, data });
    // Two minutes at most.
    while (chunks.length && frame - chunks[0].frame > ac.sampleRate * 120) chunks.shift();
  };
  let node: AudioNode;
  try {
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
    await ac.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const w = new AudioWorkletNode(ac, 'riffbox-tap', { channelCount: 1, channelCountMode: 'explicit' });
    w.port.onmessage = e => keep(e.data.frame, e.data.data);
    node = w;
  } catch {
    const sp = ac.createScriptProcessor(1024, 1, 1);
    sp.onaudioprocess = e => keep(Math.round(e.playbackTime * ac.sampleRate), e.inputBuffer.getChannelData(0).slice(0));
    node = sp;
  }
  src.connect(node); node.connect(sink);
  return {
    between(from, to) {
      const a = Math.round(from * ac.sampleRate), b = Math.round(to * ac.sampleRate);
      const out = new Float32Array(Math.max(0, b - a));
      for (const c of chunks) {
        const s = Math.max(a, c.frame), e = Math.min(b, c.frame + c.data.length);
        if (e > s) out.set(c.data.subarray(s - c.frame, e - c.frame), s - a);
      }
      return out;
    },
    stop() { stream.getTracks().forEach(t => t.stop()); node.disconnect(); src.disconnect(); },
  };
}
