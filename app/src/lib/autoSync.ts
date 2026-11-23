/**
 * Automatic Google Drive sync: at start, when the app comes back to the screen, a little after
 * each change, and every few minutes. When Google wants the player to sign in again (about once an
 * hour), the sync waits for a tap on « Synchroniser ».
 */
import { useSyncExternalStore } from 'react';
import { syncOnce, type SyncRemote, type SyncResult } from './cloudSync';
import { DriveAuthError, driveConfigured, driveRemote, signIn, signOut, tokenValid } from './googleDrive';
export { preloadGoogle } from './googleDrive';
import { onAnyWrite } from './store';

const STATE_KEY = 'riffbox-drive-state';
export interface DriveState {
  connected: boolean;
  /** Syncing now, waiting for a tap (sign in again), or idle. */
  status: 'idle' | 'syncing' | 'needsTap' | 'error';
  lastSync?: number;
  lastResult?: SyncResult;
  error?: string;
}
const read = (): DriveState => { try { return { status: 'idle', ...JSON.parse(localStorage.getItem(STATE_KEY) ?? '{"connected":false}') }; } catch { return { connected: false, status: 'idle' }; } };
let state: DriveState = read();
const listeners = new Set<() => void>();
function set(patch: Partial<DriveState>) {
  state = { ...state, ...patch };
  try { localStorage.setItem(STATE_KEY, JSON.stringify({ ...state, status: state.status === 'syncing' ? 'idle' : state.status })); } catch { /* private mode */ }
  listeners.forEach(l => l());
}
export const useDriveState = () => useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => state);

/** An in-memory remote that automated tests can put in place of the Drive. */
const fake = () => (window as unknown as { __riffboxFakeDrive?: SyncRemote }).__riffboxFakeDrive;
export const syncAvailable = () => !!fake() || driveConfigured();

let running: Promise<void> | null = null;
/** One sync now. `interactive` (after a tap): may ask Google to sign in again. */
export function syncNow(interactive = false): Promise<void> {
  if (!state.connected) return Promise.resolve();
  if (running) return running;
  running = (async () => {
    try {
      const remote = fake();
      if (!remote && !tokenValid()) {
        if (!interactive) { set({ status: 'needsTap' }); return; }
        await signIn(false);
      }
      set({ status: 'syncing', error: undefined });
      const r = await syncOnce(remote ?? driveRemote());
      set({ status: 'idle', lastSync: Date.now(), lastResult: r });
    } catch (e) {
      if (e instanceof DriveAuthError) set({ status: 'needsTap' });
      else set({ status: 'error', error: (e as Error).message || 'Synchronisation impossible.' });
    } finally { running = null; }
  })();
  return running;
}

/** First connection (after a tap): Google asks for the permission, then a first sync. */
export async function connectDrive() {
  if (!fake()) await signIn(true);
  set({ connected: true, status: 'idle', error: undefined });
  await syncNow(true);
}
export async function disconnectDrive() {
  if (!fake()) await signOut();
  set({ connected: false, status: 'idle', lastResult: undefined });
}

let installed = false;
export function installAutoSync() {
  if (installed) return;
  installed = true;
  let timer = 0;
  // Writes made by the sync itself skip the hooks and are not reported here.
  onAnyWrite(() => { clearTimeout(timer); timer = window.setTimeout(() => void syncNow(), 15_000); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void syncNow(); });
  window.addEventListener('online', () => void syncNow());
  window.setInterval(() => void syncNow(), 5 * 60_000);
  void syncNow();
}
