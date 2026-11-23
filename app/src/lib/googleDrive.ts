/**
 * Google Drive as the sync's remote store: the app's own hidden folder in the player's Drive
 * (« appDataFolder »: only RIFFBOX sees it; the rest of the Drive is never accessible). Sign-in with
 * Google Identity Services; an access token lasts about an hour.
 */
import type { SyncRemote } from './cloudSync';

/** OAuth client of the app (public: it only identifies the app to Google). */
export const GOOGLE_CLIENT_ID = '';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const DATA_NAME = 'riffbox-sync.json';
const AUDIO_PREFIX = 'audio-';
/** Kept outside the app's data (it must never travel to other devices). */
const TOKEN_KEY = 'riffbox-drive-token';

export const driveConfigured = () => !!GOOGLE_CLIENT_ID;

interface Token { access_token: string; expires_at: number }
const readToken = (): Token | null => { try { return JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null'); } catch { return null; } };
export const tokenValid = () => { const t = readToken(); return !!t && t.expires_at > Date.now() + 60_000; };

type TokenClient = { requestAccessToken: (o?: { prompt?: string }) => void };
type Gis = { accounts: { oauth2: { initTokenClient: (c: object) => TokenClient; revoke: (t: string, cb?: () => void) => void } } };
let gisLoad: Promise<Gis> | null = null;
function loadGis(): Promise<Gis> {
  const w = window as unknown as { google?: Gis };
  if (w.google?.accounts?.oauth2) return Promise.resolve(w.google);
  gisLoad ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => (w.google ? resolve(w.google) : reject(new Error('Google indisponible')));
    s.onerror = () => { gisLoad = null; reject(new Error('Google indisponible : pas de réseau ?')); };
    document.head.appendChild(s);
  });
  return gisLoad;
}

/**
 * A token, asking Google when needed. `prompt: 'consent'` the first time; afterwards Google answers
 * without asking again (a window may flash). Must follow a tap or a click (browsers block pop-ups).
 */
export async function signIn(firstTime = false): Promise<void> {
  const gis = await loadGis();
  await new Promise<void>((resolve, reject) => {
    const client = gis.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: (r: { access_token?: string; expires_in?: number; error?: string }) => {
        if (!r.access_token) { reject(new Error(r.error === 'access_denied' ? 'Accès refusé.' : 'Connexion impossible.')); return; }
        localStorage.setItem(TOKEN_KEY, JSON.stringify({ access_token: r.access_token, expires_at: Date.now() + (r.expires_in ?? 3600) * 1000 }));
        resolve();
      },
      error_callback: () => reject(new Error('Fenêtre de connexion fermée ou bloquée.')),
    });
    client.requestAccessToken({ prompt: firstTime ? 'consent' : '' });
  });
}
export async function signOut() {
  const t = readToken();
  localStorage.removeItem(TOKEN_KEY);
  if (t) { try { (await loadGis()).accounts.oauth2.revoke(t.access_token); } catch { /* offline: the token expires anyway */ } }
}

export class DriveAuthError extends Error {}
async function call(url: string, init: RequestInit = {}): Promise<Response> {
  const t = readToken();
  if (!t || t.expires_at < Date.now()) throw new DriveAuthError('Reconnexion à Google nécessaire.');
  const r = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${t.access_token}` } });
  if (r.status === 401) { localStorage.removeItem(TOKEN_KEY); throw new DriveAuthError('Reconnexion à Google nécessaire.'); }
  if (!r.ok) throw new Error(`Google Drive : erreur ${r.status}`);
  return r;
}

interface DriveFile { id: string; name: string }
async function listFiles(): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let page = '';
  do {
    const r = await call(`${API}/files?spaces=appDataFolder&pageSize=1000&fields=nextPageToken,files(id,name)${page ? `&pageToken=${page}` : ''}`);
    const j = await r.json() as { files: DriveFile[]; nextPageToken?: string };
    out.push(...j.files);
    page = j.nextPageToken ?? '';
  } while (page);
  return out;
}

/** A new file, or new content for an existing one; resumable upload for big recordings. */
async function upload(name: string, body: Blob, existingId?: string) {
  if (existingId) { await call(`${UPLOAD}/files/${existingId}?uploadType=media`, { method: 'PATCH', body }); return; }
  const meta = { name, parents: ['appDataFolder'] };
  if (body.size < 4 * 1024 * 1024) {
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
    form.append('file', body);
    await call(`${UPLOAD}/files?uploadType=multipart`, { method: 'POST', body: form });
    return;
  }
  const start = await call(`${UPLOAD}/files?uploadType=resumable`, {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify(meta),
  });
  await fetch(start.headers.get('Location')!, { method: 'PUT', body });
}

/** The Drive as a sync remote (file ids cached for one sync round). */
export function driveRemote(): SyncRemote {
  let files: Promise<DriveFile[]> | null = null;
  const all = () => (files ??= listFiles());
  return {
    async getData() {
      const f = (await all()).find(x => x.name === DATA_NAME);
      if (!f) return null;
      return (await call(`${API}/files/${f.id}?alt=media`)).json();
    },
    async putData(data) {
      const f = (await all()).find(x => x.name === DATA_NAME);
      await upload(DATA_NAME, new Blob([JSON.stringify(data)], { type: 'application/json' }), f?.id);
    },
    async audioIds() {
      return new Set((await all()).filter(x => x.name.startsWith(AUDIO_PREFIX)).map(x => x.name.slice(AUDIO_PREFIX.length)));
    },
    async getAudio(id) {
      const f = (await all()).find(x => x.name === AUDIO_PREFIX + id);
      return f ? (await call(`${API}/files/${f.id}?alt=media`)).blob() : null;
    },
    async putAudio(id, blob) { await upload(AUDIO_PREFIX + id, blob); },
  };
}
