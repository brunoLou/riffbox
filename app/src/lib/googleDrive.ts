/**
 * Google Drive as the sync's remote store: the app's own hidden folder in the player's Drive
 * (« appDataFolder »: only RIFFBOX sees it; the rest of the Drive is never accessible). Sign-in with
 * Google Identity Services; an access token lasts about an hour.
 */
import type { SyncRemote } from './cloudSync';

/** OAuth client of the app (public: it only identifies the app to Google). */
export const GOOGLE_CLIENT_ID = '391513495591-86boohtji5tht41ca7dbnsoqk2vb455t.apps.googleusercontent.com';
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

/** Loads Google's sign-in ahead of the tap, so its window opens right on the tap (no pop-up blocker). */
export const preloadGoogle = () => { if (driveConfigured()) loadGis().catch(() => { /* offline: retried on the tap */ }); };

const storeToken = (access_token: string, expiresIn: number) =>
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ access_token, expires_at: Date.now() + expiresIn * 1000 }));

/* ---------- Lasting connection (the app's small Vercel function, api/drive-token.ts) ---------- */

const SERVER = '/api/drive-token';
const post = (body: object) => fetch(SERVER, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
let ready: Promise<boolean> | null = null;
/** Is the lasting connection available (the function deployed, with the client secret)? */
export function serverReady(): Promise<boolean> {
  ready ??= fetch(SERVER, { cache: 'no-store' }).then(
    // No function there (the app served elsewhere): answers something that is not its JSON.
    r => (r.ok ? r.json().then((j: { ready?: boolean }) => !!j?.ready, () => false) : false),
    () => { ready = null; return false; }, // offline: ask again next time
  );
  return ready;
}
/** A new access token without asking the player (the function keeps the lasting authorization). */
export async function refreshSilently(): Promise<boolean> {
  if (!(await serverReady())) return false;
  try {
    const r = await post({ action: 'refresh' });
    if (!r.ok) return false;
    const j = await r.json() as { access_token: string; expires_in: number };
    storeToken(j.access_token, j.expires_in);
    return true;
  } catch { return false; }
}
async function exchangeCode(code: string): Promise<string | null> {
  try {
    const r = await post({ action: 'exchange', code, redirect_uri: redirectUri() });
    const j = await r.json() as { access_token?: string; expires_in?: number; scope?: string; error?: string };
    if (!r.ok || !j.access_token) return `Connexion impossible (${j.error ?? r.status}).`;
    if (j.scope && !j.scope.includes('drive.appdata')) return 'Autorisez l’accès au dossier de RIFFBOX dans votre Drive (case à cocher chez Google).';
    storeToken(j.access_token, j.expires_in ?? 3600);
    return null;
  } catch { return 'Connexion impossible : pas de réseau ?'; }
}

/**
 * On a phone (or the installed app), Google's small window is often blocked or never answers: the
 * app goes to Google's page instead, and Google brings the player back with the token.
 */
const REDIRECT_KEY = 'riffbox-drive-redirect';
export type SignInIntent = 'connect' | 'sync';
export const prefersRedirect = () => {
  try { return matchMedia('(pointer: coarse)').matches || matchMedia('(display-mode: standalone)').matches; } catch { return false; }
};
/** The address Google sends the player back to (declared in the Google console). */
export const redirectUri = () => location.origin + '/';

export function authUrl(state: string, firstTime: boolean, lasting = false) {
  const q = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID, redirect_uri: redirectUri(), response_type: lasting ? 'code' : 'token', scope: SCOPE,
    include_granted_scopes: 'true', state,
  });
  // A lasting connection: Google gives the long-lived authorization only along with its consent page.
  if (lasting) { q.set('access_type', 'offline'); q.set('prompt', 'consent'); }
  else if (firstTime) q.set('prompt', 'consent');
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + q.toString();
}

function redirectSignIn(firstTime: boolean, intent: SignInIntent, lasting = false): Promise<void> {
  const state = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  localStorage.setItem(REDIRECT_KEY, JSON.stringify({ state, intent, back: location.hash || '#/' }));
  location.assign(authUrl(state, firstTime, lasting));
  return new Promise(() => { /* the page leaves for Google */ });
}

export interface RedirectAnswer { intent: SignInIntent; error?: string; code?: string }
/**
 * At start-up, before the screens: Google's answer in the address after a sign-in by redirect
 * (`#access_token=…`, or `?code=…` for a lasting connection). Keeps the token (or the code, to be
 * exchanged by `finishRedirect`), puts back the screen the player was on, and says what was asked.
 */
export function consumeRedirect(): RedirectAnswer | null {
  const inHash = /^#(.*&)?(access_token|error)=/.test(location.hash);
  const inQuery = /[?&](code|error)=/.test(location.search) && /[?&]state=/.test(location.search);
  if (!inHash && !inQuery) return null;
  const p = new URLSearchParams(inHash ? location.hash.slice(1) : location.search.slice(1));
  let saved: { state: string; intent: SignInIntent; back: string } | null = null;
  try { saved = JSON.parse(localStorage.getItem(REDIRECT_KEY) ?? 'null'); } catch { /* none */ }
  localStorage.removeItem(REDIRECT_KEY);
  history.replaceState(null, '', location.pathname + (saved?.back ?? '#/'));
  if (!saved || p.get('state') !== saved.state) return { intent: 'sync', error: 'Réponse de Google inattendue : réessayez.' };
  const err = p.get('error');
  if (err) return { intent: saved.intent, error: err === 'access_denied' ? 'Accès refusé.' : `Connexion impossible (${err}).` };
  if (!(p.get('scope') ?? SCOPE).includes('drive.appdata')) {
    return { intent: saved.intent, error: 'Autorisez l’accès au dossier de RIFFBOX dans votre Drive (case à cocher chez Google).' };
  }
  const code = p.get('code');
  if (code) return { intent: saved.intent, code };
  const token = p.get('access_token');
  if (!token) return { intent: saved.intent, error: 'Connexion impossible.' };
  storeToken(token, Number(p.get('expires_in')) || 3600);
  return { intent: saved.intent };
}
/** For a lasting connection: trade Google's code for the token. Null when done, else the error. */
export const finishRedirect = (a: RedirectAnswer) => (a.code ? exchangeCode(a.code) : Promise.resolve(a.error ?? null));

/**
 * A token, asking Google when needed. `firstTime`: Google asks for the permission; afterwards it
 * answers without asking again. Must follow a tap or a click.
 */
export async function signIn(firstTime = false, intent: SignInIntent = 'sync'): Promise<void> {
  // The lasting connection goes through Google's page (on every device), so it never asks again.
  if (await serverReady()) return redirectSignIn(firstTime, intent, true);
  if (prefersRedirect()) return redirectSignIn(firstTime, intent);
  const gis = await loadGis();
  await new Promise<void>((resolve, reject) => {
    // Never stuck: without an answer from Google's window, give up (the button works again).
    const timer = setTimeout(() => reject(new Error('Google ne répond pas : réessayez.')), 120_000);
    const done = (fn: () => void) => { clearTimeout(timer); fn(); };
    const client = gis.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: (r: { access_token?: string; expires_in?: number; error?: string }) => done(() => {
        if (!r.access_token) { reject(new Error(r.error === 'access_denied' ? 'Accès refusé.' : 'Connexion impossible.')); return; }
        storeToken(r.access_token, r.expires_in ?? 3600);
        resolve();
      }),
      error_callback: (e: { type?: string }) => done(() => reject(new Error(e?.type === 'popup_failed_to_open'
        ? 'La fenêtre Google a été bloquée : autorisez les fenêtres pop-up pour ce site.'
        : 'Fenêtre de connexion fermée.'))),
    });
    client.requestAccessToken({ prompt: firstTime ? 'consent' : '' });
  });
}
export async function signOut() {
  const t = readToken();
  localStorage.removeItem(TOKEN_KEY);
  if (await serverReady()) await post({ action: 'logout' }).catch(() => undefined);
  if (t) { try { (await loadGis()).accounts.oauth2.revoke(t.access_token); } catch { /* offline: the token expires anyway */ } }
}

export class DriveAuthError extends Error {}
async function call(url: string, init: RequestInit = {}, retried = false): Promise<Response> {
  let t = readToken();
  if ((!t || t.expires_at < Date.now() + 30_000) && await refreshSilently()) t = readToken();
  if (!t || t.expires_at < Date.now()) throw new DriveAuthError('Reconnexion à Google nécessaire.');
  // Never an old copy from the browser's cache: the other device may just have sent a new one.
  const r = await fetch(url, { ...init, cache: 'no-store', headers: { ...(init.headers ?? {}), Authorization: `Bearer ${t.access_token}` } });
  if (r.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    if (!retried && await refreshSilently()) return call(url, init, true);
    throw new DriveAuthError('Reconnexion à Google nécessaire.');
  }
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
