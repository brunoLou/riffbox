/**
 * WAV files for music software (DAW): 24-bit PCM, with the title in a LIST/INFO chunk and, when
 * known, the tempo and root note in an « acid » chunk (read by Ableton Live, FL Studio, Acid…).
 */

export interface WavMeta {
  title?: string;
  /** Free text (key, tempo, date…), shown by Reaper and others. */
  comment?: string;
  /** ISO date (YYYY-MM-DD). */
  date?: string;
  bpm?: number;
  /** Pitch class of the root (0 = C). */
  root?: number;
}

const enc = new TextEncoder();
/** A RIFF chunk: id, little-endian size, data, padded to an even length. */
function chunk(id: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + body.length + (body.length & 1));
  out.set(enc.encode(id), 0);
  new DataView(out.buffer).setUint32(4, body.length, true);
  out.set(body, 8);
  return out;
}
const zstr = (s: string) => { const b = enc.encode(s); const o = new Uint8Array(b.length + 1); o.set(b); return o; };
const concat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

function infoChunk(m: WavMeta): Uint8Array | null {
  const fields: [string, string | undefined][] = [['INAM', m.title], ['ICMT', m.comment], ['ICRD', m.date], ['ISFT', 'RIFFBOX']];
  const subs = fields.filter(([, v]) => v).map(([id, v]) => chunk(id, zstr(v!)));
  return subs.length ? chunk('LIST', concat([enc.encode('INFO'), ...subs])) : null;
}

/** The « acid » chunk: tempo, root note and length in beats, so loops land on the project's grid. */
function acidChunk(m: WavMeta, seconds: number): Uint8Array | null {
  if (!m.bpm && m.root === undefined) return null;
  const b = new Uint8Array(24);
  const v = new DataView(b.buffer);
  // Flags: 0x02 root note set. Not a one-shot, not stretched by default.
  v.setUint32(0, m.root !== undefined ? 0x02 : 0, true);
  v.setUint16(4, 60 + (m.root ?? 0), true); // MIDI note, C4 = 60
  v.setUint16(6, 0x8000, true);
  v.setFloat32(8, 0, true);
  v.setUint32(12, m.bpm ? Math.max(1, Math.round((seconds * m.bpm) / 60)) : 0, true);
  v.setUint16(16, 4, true); // meter denominator
  v.setUint16(18, 4, true); // meter numerator
  v.setFloat32(20, m.bpm ?? 0, true);
  return chunk('acid', b);
}

/** Encode decoded audio as a 24-bit WAV file. */
export function encodeWav(channels: Float32Array[], sampleRate: number, meta: WavMeta = {}): Blob {
  const nch = channels.length, frames = channels[0]?.length ?? 0, bps = 3;
  const fmt = new Uint8Array(16);
  const f = new DataView(fmt.buffer);
  f.setUint16(0, 1, true); // PCM
  f.setUint16(2, nch, true);
  f.setUint32(4, sampleRate, true);
  f.setUint32(8, sampleRate * nch * bps, true);
  f.setUint16(12, nch * bps, true);
  f.setUint16(14, 24, true);

  const data = new Uint8Array(frames * nch * bps);
  let o = 0;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < nch; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      const n = Math.round(s < 0 ? s * 0x800000 : s * 0x7fffff);
      data[o++] = n & 0xff; data[o++] = (n >> 8) & 0xff; data[o++] = (n >> 16) & 0xff;
    }
  }
  const parts = [chunk('fmt ', fmt), acidChunk(meta, frames / sampleRate), infoChunk(meta), chunk('data', data)].filter((p): p is Uint8Array => !!p);
  const body = concat([enc.encode('WAVE'), ...parts]);
  return new Blob([chunk('RIFF', body)], { type: 'audio/wav' });
}

/** Decode a recording (WebM/Opus, MP4/AAC…) at 48 kHz, the usual rate of music projects. */
export async function decodeRecording(blob: Blob, sampleRate = 48000): Promise<{ channels: Float32Array[]; sampleRate: number }> {
  const ac = new OfflineAudioContext(1, 1, sampleRate);
  const buf = await ac.decodeAudioData(await blob.arrayBuffer());
  const channels = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
  return { channels: sameChannels(channels) ? [channels[0]] : channels, sampleRate: buf.sampleRate };
}

/** A microphone often records the same sound on both sides: one channel (a mono track) is enough. */
export function sameChannels(ch: Float32Array[]): boolean {
  if (ch.length < 2) return false;
  const [a, b] = ch;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 1e-4) return false;
  return true;
}
