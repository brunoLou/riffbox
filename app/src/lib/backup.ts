/** Backup file: every saved value plus the audio recordings, in one JSON file. */
import { allBlobs, clearBlobs, getBlob, putBlob } from './blobs';
import { INITIAL_GRIDS } from './grids';
import { INITIAL_IDEAS, type Idea } from './ideas';
import { INITIAL_SETLISTS, INITIAL_SONGS } from './setlists';
import { allStored, clearAllStored, readStored, writeStored } from './store';

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

/** Collections merged item by item (by id) on import; existing items are never overwritten. */
const COLLECTIONS = ['ideas', 'grids', 'songs', 'setlists', 'voice.takes'];
/** Defaults written into the file when never modified, so the backup is complete on its own. */
const DEFAULTS: Record<string, unknown> = { ideas: INITIAL_IDEAS, grids: INITIAL_GRIDS, songs: INITIAL_SONGS, setlists: INITIAL_SETLISTS };

const toDataUrl = (b: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(r.error);
  r.readAsDataURL(b);
});
const fromDataUrl = async (u: string) => (await fetch(u)).blob();

export async function buildBackup(): Promise<BackupFile> {
  const data = allStored();
  for (const [k, def] of Object.entries(DEFAULTS)) if (!(k in data)) data[k] = readStored(k, def);
  // Session-only playback URLs never go into the file.
  data.ideas = (data.ideas as Idea[]).map(({ audioUrl: _u, ...rest }) => rest);
  const audio: Record<string, string> = {};
  for (const { id, blob } of await allBlobs()) audio[id] = await toDataUrl(blob);
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data, audio };
}

export const backupFileName = (d = new Date()) =>
  `riffbox-sauvegarde-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;

/** Share the file (phone share sheet) when possible, else download it. Returns how it was handed over. */
export async function saveBackup(b: BackupFile): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const name = backupFileName();
  const blob = new Blob([JSON.stringify(b)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], title: 'Sauvegarde RIFFBOX' }); return 'shared'; }
    catch (e) { if ((e as Error).name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}

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
  for (const [k, v] of Object.entries(b.data)) writeStored(k, v);
  for (const [id, u] of Object.entries(b.audio)) await putBlob(id, await fromDataUrl(u));
}

/**
 * Add the backup to the current data: new items join each collection, existing ones are kept,
 * practice minutes keep the larger value per day, other settings are only filled in when missing.
 * Returns how many items were added.
 */
export async function restoreMerge(b: BackupFile): Promise<number> {
  const current = allStored();
  let added = 0;
  for (const [k, v] of Object.entries(b.data)) {
    if (COLLECTIONS.includes(k)) {
      const mine = (current[k] as { id: string }[] | undefined) ?? (readStored(k, DEFAULTS[k] ?? []) as { id: string }[]);
      const ids = new Set(mine.map(x => x.id));
      const extra = (v as { id: string }[]).filter(x => x && typeof x.id === 'string' && !ids.has(x.id));
      added += extra.length;
      writeStored(k, [...mine, ...extra]);
    } else if (k === 'practice.log' && v && typeof v === 'object') {
      const mine = (current[k] as Record<string, number>) ?? {};
      const merged = { ...mine };
      for (const [day, min] of Object.entries(v as Record<string, number>)) merged[day] = Math.max(merged[day] ?? 0, min);
      writeStored(k, merged);
    } else if (!(k in current)) {
      writeStored(k, v);
    }
  }
  for (const [id, u] of Object.entries(b.audio)) if (!(await getBlob(id))) await putBlob(id, await fromDataUrl(u));
  return added;
}
