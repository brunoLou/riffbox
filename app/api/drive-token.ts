/**
 * Keeps RIFFBOX connected to the player's Google Drive without asking again every hour.
 * Google gives a browser app an access token for one hour only; this small function keeps the
 * long-lived « refresh token » in a cookie the page cannot read, and hands the page a fresh access
 * token whenever it needs one. It needs the OAuth client's secret in the Vercel environment
 * (GOOGLE_CLIENT_SECRET); without it, it says so and the app keeps its hourly sign-in.
 *
 * GET  → { ready }                         is the secret configured?
 * POST { action: 'exchange', code, redirect_uri } → { access_token, expires_in } (+ cookie)
 * POST { action: 'refresh' }               → { access_token, expires_in } | 401
 * POST { action: 'logout' }                → revokes and forgets
 */
declare const process: { env: Record<string, string | undefined> };

const CLIENT_ID = '391513495591-86boohtji5tht41ca7dbnsoqk2vb455t.apps.googleusercontent.com';
const COOKIE = 'rb_drive_rt';
const YEAR = 365 * 86400;

const secret = () => process.env.GOOGLE_CLIENT_SECRET ?? '';
const clientId = () => process.env.GOOGLE_CLIENT_ID || CLIENT_ID;

const json = (body: unknown, status = 200, cookie?: string) => {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  if (cookie) headers.append('Set-Cookie', cookie);
  return new Response(JSON.stringify(body), { status, headers });
};
const setCookie = (value: string) => `${COOKIE}=${encodeURIComponent(value)}; Path=/api; Max-Age=${YEAR}; HttpOnly; Secure; SameSite=Strict`;
const clearCookie = () => `${COOKIE}=; Path=/api; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
function readCookie(req: Request) {
  const m = (req.headers.get('cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : '';
}

async function google(params: Record<string, string>) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId(), client_secret: secret(), ...params }),
  });
  return { ok: r.ok, body: (await r.json().catch(() => ({}))) as Record<string, unknown> };
}

export function GET() {
  if (secret()) return json({ ready: true });
  // To help setting it up: the names (never the values) of variables that look like the one expected.
  const near = Object.keys(process.env).filter(k => /google|secret|client/i.test(k) && !/^VERCEL|^NEXT|^npm_/i.test(k));
  return json({ ready: false, expected: 'GOOGLE_CLIENT_SECRET', near, env: process.env.VERCEL_ENV ?? null });
}

export async function POST(req: Request) {
  if (!secret()) return json({ error: 'not_configured' }, 501);
  // Only the app's own pages may call it.
  const origin = req.headers.get('origin');
  const self = new URL(req.url).origin;
  if (origin && origin !== self) return json({ error: 'forbidden' }, 403);
  const body = (await req.json().catch(() => ({}))) as { action?: string; code?: string; redirect_uri?: string };

  if (body.action === 'exchange') {
    if (!body.code || body.redirect_uri !== `${self}/`) return json({ error: 'bad_request' }, 400);
    const g = await google({ grant_type: 'authorization_code', code: body.code, redirect_uri: body.redirect_uri });
    if (!g.ok || typeof g.body.access_token !== 'string') return json({ error: String(g.body.error ?? 'exchange_failed') }, 400);
    const rt = typeof g.body.refresh_token === 'string' ? g.body.refresh_token : readCookie(req);
    return json({ access_token: g.body.access_token, expires_in: g.body.expires_in ?? 3600, scope: g.body.scope ?? '', lasting: !!rt },
      200, rt ? setCookie(rt) : undefined);
  }

  if (body.action === 'refresh') {
    const rt = readCookie(req);
    if (!rt) return json({ error: 'no_session' }, 401);
    const g = await google({ grant_type: 'refresh_token', refresh_token: rt });
    if (!g.ok || typeof g.body.access_token !== 'string') {
      // Revoked, or expired (an app in « testing » at Google: after 7 days).
      return json({ error: String(g.body.error ?? 'refresh_failed') }, 401, g.body.error === 'invalid_grant' ? clearCookie() : undefined);
    }
    return json({ access_token: g.body.access_token, expires_in: g.body.expires_in ?? 3600 });
  }

  if (body.action === 'logout') {
    const rt = readCookie(req);
    if (rt) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(rt)}`, { method: 'POST' }).catch(() => undefined);
    return json({ ok: true }, 200, clearCookie());
  }
  return json({ error: 'bad_request' }, 400);
}
