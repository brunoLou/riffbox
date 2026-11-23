/** Backup file: every saved value plus the audio recordings, in one JSON file. */
import { dateStamp, shareOrDownload } from './files';
import { allBlobs, clearBlobs, putBlob } from './blobs';
import { INITIAL_GRIDS } from './grids';
import { INITIAL_IDEAS, type Idea } from './ideas';
import { INITIAL_SETLISTS, INITIAL_SONGS } from './setlists';
import { allStored, clearAllStored, readStored, withoutWriteHooks, writeStored } from './store';
import { LOCAL_KEYS, planMerge, type MergePlan, type MergeStats } from './sync';

export const BACKUP_APP = 'riffbox';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  data: Record<string, unknown>;
  /** Recordings, as data URLs, by id. */
  audio: Record<string, string>;
}

/** Collections checked when reading a file (merged item by item: see sync.ts). */
const COLLECTIONS = ['ideas', 'grids', 'songs', 'setlists', 'voice.takes', 'tuner.custom'];
/** Defaults written into the file when never modified, so the backup is complete on its own. */
const DEFAULTS: Record<string, unknown> = { ideas: INITIAL_IDEAS, grids: INITIAL_GRIDS, songs: INITIAL_SONGS, setlists: INITIAL_SETLISTS };

const toDataUrl = (b: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(r.error);
  r.readAsDataURL(b);
});
const fromDataUrl = async (u: string) => (await fetch(u)).blob();

/** Everything the other devices share (device settings and the sync's own state left out). */
export function syncSnapshot(): Record<string, unknown> {
  const data = allStored();
  for (const [k, def] of Object.entries(DEFAULTS)) if (!(k in data)) data[k] = readStored(k, def);
  if (Array.isArray(data.ideas)) data.ideas = (data.ideas as Idea[]).map(({ audioUrl: _u, ...rest }) => rest);
  for (const k of LOCAL_KEYS) delete data[k];
  return data;
}
export const SNAPSHOT_DEFAULTS = DEFAULTS;

export async function buildBackup(): Promise<BackupFile> {
  const data = allStored();
  for (const [k, def] of Object.entries(DEFAULTS)) if (!(k in data)) data[k] = readStored(k, def);
  // Session-only playback URLs never go into the file.
  data.ideas = (data.ideas as Idea[]).map(({ audioUrl: _u, ...rest }) => rest);
  const audio: Record<string, string> = {};
  for (const { id, blob } of await allBlobs()) audio[id] = await toDataUrl(blob);
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data, audio };
}

export const backupFileName = (d = new Date()) => `riffbox-sauvegarde-${dateStamp(d)}.json`;

/** Share the file (phone share sheet) when possible, else download it. Returns how it was handed over. */
export const saveBackup = (b: BackupFile) =>
  shareOrDownload(backupFileName(), new Blob([JSON.stringify(b)], { type: 'application/json' }), 'Sauvegarde RIFFBOX');

/** Parse and check a backup file; throws a French message when it is not a RIFFBOX backup. */
export async function readBackup(file: File): Promise<BackupFile> {
  let parsed: unknown;
  try { parsed = JSON.parse(await file.text()); } catch { throw new Error('Ce fichier n’est pas une sauvegarde RIFFBOX (format illisible).'); }
  const b = parsed as Partial<BackupFile>;
  if (!b || b.app !== BACKUP_APP || typeof b.data !== 'object' || b.data === null) throw new Error('Ce fichier n’est pas une sauvegarde RIFFBOX.');
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) throw new Error('Cette sauvegarde vient d’une version plus récente de RIFFBOX.');
  for (const k of COLLECTIONS) if (k in b.data && !Array.isArray(b.data[k])) throw new Error('Sauvegarde abîmée : certaines données sont illisibles.');
  const audio = typeof b.audio === 'object' && b.audio ? b.audio : {};
  for (const v of Object.values(audio)) if (typeof v !== 'string' || !v.startsWith('data:')) throw new Error('Sauvegarde abîmée : un enregistrement est illisible.');
  return { app: BACKUP_APP, version: b.version, exportedAt: String(b.exportedAt ?? ''), data: b.data as Record<string, unknown>, audio: audio as Record<string, string> };
}

export interface BackupSummary { date: string; ideas: number; grids: number; songs: number; setlists: number; takes: number; recordings: number; days: number }
export function summarize(b: BackupFile): BackupSummary {
  const len = (k: string) => (Array.isArray(b.data[k]) ? (b.data[k] as unknown[]).length : 0);
  const log = b.data['practice.log'];
  return {
    date: b.exportedAt ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(b.exportedAt)) : 'date inconnue',
    ideas: len('ideas'), grids: len('grids'), songs: len('songs'), setlists: len('setlists'), takes: len('voice.takes'),
    recordings: Object.keys(b.audio).length,
    days: log && typeof log === 'object' ? Object.values(log as Record<string, number>).filter(m => m > 0).length : 0,
  };
}

/** Replace everything with the backup. The app reloads afterwards. */
export async function restoreReplace(b: BackupFile) {
  clearAllStored();
  await clearBlobs();
  withoutWriteHooks(() => { for (const [k, v] of Object.entries(b.data)) writeStored(k, v); });
  for (const [id, u] of Object.entries(b.audio)) await putBlob(id, await fromDataUrl(u));
}

/** What receiving this file would change here (for the preview). */
export function previewMerge(b: BackupFile): MergePlan {
  const current = allStored();
  return planMerge(b.data, k => current[k], DEFAULTS);
}

/**
 * Bring the other device's data in: new items join, the most recent version of each item wins,
 * items deleted on either side stay deleted, practice minutes keep the larger value per day,
 * device settings stay as they are. Recordings of new or newer items come from the file.
 */
export async function restoreMerge(b: BackupFile): Promise<MergeStats> {
  const plan = previewMerge(b);
  // The merged items already carry their own dates: write them as they are.
  withoutWriteHooks(() => { for (const [k, v] of Object.entries(plan.writes)) writeStored(k, v); });
  for (const id of plan.audioIds) if (b.audio[id]) await putBlob(id, await fromDataUrl(b.audio[id]));
  return plan.stats;
}
