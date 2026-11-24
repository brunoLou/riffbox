import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '../../api/drive-token';

const SITE = 'https://riffbox.vercel.app';
const req = (body: object, cookie = '', origin = SITE) =>
  new Request(`${SITE}/api/drive-token`, { method: 'POST', headers: { 'Content-Type': 'application/json', origin, cookie }, body: JSON.stringify(body) });
/** Google's token endpoint, simulated. */
function google(answer: (p: URLSearchParams) => [number, object]) {
  const seen: URLSearchParams[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    const p = new URLSearchParams(String(init.body ?? ''));
    seen.push(p);
    const [status, body] = answer(p);
    return new Response(JSON.stringify(body), { status });
  }));
  return seen;
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('the lasting Google connection (Vercel function)', () => {
  it('says it is not ready without the client secret, and refuses to work', async () => {
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
    expect(await GET().json()).toMatchObject({ ready: false, expected: 'GOOGLE_CLIENT_SECRET' });
    expect((await POST(req({ action: 'refresh' }))).status).toBe(501);
    // A misspelt name is pointed out (its value never).
    vi.stubEnv('GOOGLE_CLIENT_SECRET ', 'valeur');
    const j = await GET().json();
    expect(j.near).toContain('GOOGLE_CLIENT_SECRET ');
    expect(JSON.stringify(j)).not.toContain('valeur');
  });

  it('also takes the secret under the name it was saved with in Vercel', () => {
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
    vi.stubEnv('GOOGLE_KEY_SECRET', 'secret');
    return GET().json().then(j => expect(j).toEqual({ ready: true }));
  });

  it('exchanges Google’s code, keeps the lasting authorization in a cookie the page cannot read, then renews', async () => {
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'secret');
    expect(await GET().json()).toEqual({ ready: true });
    const seen = google(p => p.get('grant_type') === 'authorization_code'
      ? [200, { access_token: 'a1', expires_in: 3599, refresh_token: 'long', scope: 'https://www.googleapis.com/auth/drive.appdata' }]
      : [200, { access_token: 'a2', expires_in: 3599 }]);

    const r = await POST(req({ action: 'exchange', code: 'c', redirect_uri: `${SITE}/` }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body).toMatchObject({ access_token: 'a1', lasting: true });
    expect(JSON.stringify(body)).not.toContain('long'); // never given to the page
    const cookie = r.headers.get('set-cookie')!;
    expect(cookie).toMatch(/^rb_drive_rt=long;/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(seen[0].get('client_secret')).toBe('secret');

    const again = await POST(req({ action: 'refresh' }, 'rb_drive_rt=long'));
    expect(await again.json()).toEqual({ access_token: 'a2', expires_in: 3599 });
    expect(seen[1].get('refresh_token')).toBe('long');
  });

  it('refuses other sites, other return addresses, and a missing or revoked authorization', async () => {
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'secret');
    google(() => [400, { error: 'invalid_grant' }]);
    expect((await POST(req({ action: 'refresh' }, 'rb_drive_rt=long', 'https://ailleurs.example'))).status).toBe(403);
    expect((await POST(req({ action: 'exchange', code: 'c', redirect_uri: 'https://ailleurs.example/' }))).status).toBe(400);
    expect((await POST(req({ action: 'refresh' }))).status).toBe(401);
    const revoked = await POST(req({ action: 'refresh' }, 'rb_drive_rt=long'));
    expect(revoked.status).toBe(401);
    expect(revoked.headers.get('set-cookie')).toContain('Max-Age=0'); // forgotten
  });
});
