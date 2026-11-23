/** « Mes fichiers »: the player's own backing tracks (audio kept on the device, in IndexedDB). */

export interface MyTrack {
  id: string;
  name: string;
  created: number;
  /** Bytes and MIME type of the file. */
  size: number;
  type: string;
  /** Seconds. */
  duration: number;
  key?: number;
  minor?: boolean;
  bpm?: number;
  /** Playback speed (1 = as recorded), pitch kept. */
  speed?: number;
  /** Starts again at the end (on by default). */
  loop?: boolean;
  /** The app's backing track this file is attached to (« Blues en La »); none for a file of its own. */
  trackId?: string;
  /** For an attached file: chosen instead of the app's sound (true), or kept aside (false). */
  active?: boolean;
  updated?: number;
}
export const MY_TRACKS_KEY = 'backing.mine';
export const SPEED = { min: 0.5, max: 1.5, step: 0.05 };
/** Above this, the file is accepted but flagged (phones have limited room). */
export const BIG_FILE = 60 * 1024 * 1024;

const AUDIO_EXT = /\.(mp3|m4a|aac|wav|wave|ogg|oga|opus|flac|aif|aiff|webm|caf)$/i;
export const isAudioFile = (f: { name: string; type: string }) => f.type.startsWith('audio/') || AUDIO_EXT.test(f.name);

/** A readable name from the file name, and a tempo if the name gives one (« Blues en La 90 bpm.mp3 »). */
export function fromFileName(file: string): { name: string; bpm?: number } {
  const base = file.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  const m = base.match(/(\d{2,3})\s*bpm\b/i);
  const bpm = m ? Number(m[1]) : undefined;
  return { name: (base || 'Backing track').slice(0, 60), ...(bpm && bpm >= 30 && bpm <= 300 ? { bpm } : {}) };
}

export const fmtTime = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
};
export const fmtSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} Ko` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`);
export const clampSpeed = (v: number) => Math.round(Math.min(SPEED.max, Math.max(SPEED.min, v)) * 100) / 100;

/** The file attached to one of the app's backing tracks, if any. */
export const attachedTo = (list: MyTrack[], trackId: string) => list.find(t => t.trackId === trackId);
