/**
 * Automatic sync through a remote store (the player's Google Drive): receive the other devices'
 * data and merge it (newest version of each item wins, deletions travel: see sync.ts), send the
 * result back, and exchange the recordings each side is missing. Pure of any Google detail: the
 * remote is an interface, so the logic is tested with an in-memory one.
 */
import { SNAPSHOT_DEFAULTS, syncSnapshot } from './backup';
import { blobIds, getBlob, putBlob } from './blobs';
import { allStored, withoutWriteHooks, writeStored } from './store';
import { planMerge, type MergeStats } from './sync';

export interface SyncRemote {
  /** The shared data, or null when nothing was sent yet. */
  getData(): Promise<Record<string, unknown> | null>;
  putData(data: Record<string, unknown>): Promise<void>;
  /** Ids of the recordings already in the remote store. */
  audioIds(): Promise<Set<string>>;
  getAudio(id: string): Promise<Blob | null>;
  putAudio(id: string, blob: Blob): Promise<void>;
}
export interface LocalAudio { ids(): Promise<string[]>; get(id: string): Promise<Blob | undefined>; put(id: string, b: Blob): Promise<unknown> }
const deviceAudio: LocalAudio = { ids: blobIds, get: getBlob, put: putBlob };

export interface SyncResult { received: MergeStats; sent: boolean; audioUp: number; audioDown: number }

/** Ids of every recording the data refers to (ideas, vocal takes, own backing tracks). */
export function referencedAudio(data: Record<string, unknown>): Set<string> {
  const ids = new Set<string>();
  for (const key of ['ideas', 'voice.takes', 'backing.mine']) {
    const list = data[key];
    if (!Array.isArray(list)) continue;
    for (const x of list as { id?: string; hasAudio?: boolean; size?: number }[]) {
      if (typeof x?.id === 'string' && (key === 'backing.mine' || x.hasAudio)) ids.add(x.id);
    }
  }
  return ids;
}

const stable = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));

/** One round: receive, merge, send, then the recordings both ways. */
export async function syncOnce(remote: SyncRemote, audio: LocalAudio = deviceAudio): Promise<SyncResult> {
  const theirs = await remote.getData();
  let received: MergeStats = { added: 0, updated: 0, removed: 0 };
  if (theirs) {
    const current = allStored();
    const plan = planMerge(theirs, k => current[k], SNAPSHOT_DEFAULTS);
    withoutWriteHooks(() => { for (const [k, v] of Object.entries(plan.writes)) writeStored(k, v); });
    received = plan.stats;
  }
  const mine = syncSnapshot();
  const sent = !theirs || stable(mine) !== stable(theirs);
  if (sent) await remote.putData(mine);

  const there = await remote.audioIds();
  const here = new Set(await audio.ids());
  const wanted = referencedAudio(mine);
  let audioUp = 0, audioDown = 0;
  for (const id of here) {
    if (there.has(id) || !wanted.has(id)) continue;
    const b = await audio.get(id);
    if (b) { await remote.putAudio(id, b); audioUp++; }
  }
  for (const id of wanted) {
    if (here.has(id) || !there.has(id)) continue;
    const b = await remote.getAudio(id);
    if (b) { await audio.put(id, b); audioDown++; }
  }
  return { received, sent, audioUp, audioDown };
}
