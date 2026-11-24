import type { Page } from '@playwright/test';
import { button, expect, test } from './helpers';

/** A shared « Google Drive » kept here, in the test, that both devices talk to. */
function fakeDrive() {
  let data: unknown = null;
  const audio = new Map<string, string>();
  return {
    puts: 0,
    async attach(page: Page) {
      await page.exposeFunction('__drvGet', () => data);
      await page.exposeFunction('__drvPut', (d: unknown) => { data = d; this.puts++; });
      await page.exposeFunction('__drvIds', () => [...audio.keys()]);
      await page.exposeFunction('__drvGetAudio', (id: string) => audio.get(id) ?? null);
      await page.exposeFunction('__drvPutAudio', (id: string, b64: string) => { audio.set(id, b64); });
      await page.addInitScript(() => {
        const w = window as unknown as Record<string, (...a: unknown[]) => Promise<unknown>> & { __riffboxFakeDrive?: unknown };
        const toB64 = async (b: Blob) => { let s = ''; new Uint8Array(await b.arrayBuffer()).forEach(c => (s += String.fromCharCode(c))); return btoa(s); };
        w.__riffboxFakeDrive = {
          getData: () => w.__drvGet(),
          putData: (d: unknown) => w.__drvPut(d),
          audioIds: async () => new Set(await w.__drvIds() as string[]),
          getAudio: async (id: string) => {
            const s = await w.__drvGetAudio(id) as string | null;
            return s ? new Blob([Uint8Array.from(atob(s), c => c.charCodeAt(0))]) : null;
          },
          putAudio: async (id: string, b: Blob) => w.__drvPutAudio(id, await toB64(b)),
        };
      });
    },
  };
}

test('Google Drive: connect two devices, changes travel both ways on their own', async ({ page: phone, browser }) => {
  const drive = fakeDrive();
  await drive.attach(phone);
  await phone.goto('#/reglages');
  const card = phone.locator('.settings-card', { hasText: 'Google Drive' });
  await card.getByRole('button', { name: 'Connecter Google Drive' }).click();
  await expect(card.locator('.drive-status')).toContainText('Synchronisé à l’instant');
  expect(drive.puts).toBe(1);

  // A change on the phone, sent at once with « Synchroniser maintenant ».
  await phone.goto('#/scene/morceau/s3');
  await phone.locator('.chordpro').fill('{c:Couplet}\n[A7]Version synchronisée');
  await phone.goto('#/reglages');
  await card.getByRole('button', { name: 'Synchroniser maintenant' }).click();
  await expect(card.locator('.drive-status')).toContainText('Synchronisé');
  expect(drive.puts).toBe(2);

  // The tablet connects: it gets the phone's song and sends its own setlist.
  const ctx = await browser.newContext({ viewport: { width: 520, height: 960 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const tablet = await ctx.newPage();
  await drive.attach(tablet);
  await tablet.goto('/#/scene');
  await tablet.getByText('+ Nouvelle setlist').click();
  await tablet.locator('.set-title-input').fill('Set tablette');
  await button(tablet, 'Terminé').click();
  await tablet.goto('/#/reglages');
  const tcard = tablet.locator('.settings-card', { hasText: 'Google Drive' });
  await tcard.getByRole('button', { name: 'Connecter Google Drive' }).click();
  await expect(tcard.locator('.drive-status')).toContainText('1 changement reçu');
  await tablet.goto('/#/scene/morceau/s3');
  await expect(tablet.locator('.chordpro')).toHaveValue(/Version synchronisée/);

  // Back on the phone: coming back to the app is enough to receive the setlist.
  await phone.reload();
  await phone.goto('#/scene');
  await expect(phone.getByText('Set tablette')).toBeVisible();

  // Disconnect: no more syncing from this device.
  await phone.goto('#/reglages');
  await card.getByRole('button', { name: 'Déconnecter cet appareil…' }).click();
  await card.getByRole('button', { name: 'Déconnecter', exact: true }).click();
  await expect(card.getByRole('button', { name: 'Connecter Google Drive' })).toBeVisible();
  await ctx.close();
});

test('with the app\u2019s Google identifier, the card offers to connect (Google is not called before the tap)', async ({ page }) => {
  const google: string[] = [];
  page.on('request', r => { if (/googleapis\.com/.test(r.url())) google.push(r.url()); });
  await page.goto('#/reglages');
  const card = page.locator('.settings-card', { hasText: 'Google Drive' });
  await expect(card.getByRole('button', { name: 'Connecter Google Drive' })).toBeVisible();
  await expect(card).toContainText('dossier caché réservé à RIFFBOX');
  expect(google).toEqual([]);
});

test.describe('on a phone: sign-in through Google’s page and back', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('« Connecter » goes to Google, which brings the player back to the app, connected', async ({ page }) => {
    let asked: URL | null = null;
    await page.route('https://accounts.google.com/gsi/**', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.route('https://accounts.google.com/o/oauth2/**', r => { asked = new URL(r.request().url()); return r.fulfill({ contentType: 'text/html', body: '<p>Google</p>' }); });
    await page.goto('#/reglages');
    await page.getByRole('button', { name: 'Connecter Google Drive' }).click();
    await expect.poll(() => asked?.pathname).toBe('/o/oauth2/v2/auth');
    const q = asked!.searchParams;
    expect(q.get('response_type')).toBe('token');
    expect(q.get('scope')).toBe('https://www.googleapis.com/auth/drive.appdata');
    expect(q.get('prompt')).toBe('consent');
    expect(q.get('redirect_uri')).toMatch(/^http:\/\/localhost:\d+\/$/);
    const state = q.get('state')!;

    // Google sends the player back with the token in the address (the Drive is simulated here).
    const drive = fakeDrive();
    await drive.attach(page);
    await page.goto(`/#access_token=jeton&token_type=Bearer&expires_in=3599&scope=${encodeURIComponent(q.get('scope')!)}&state=${state}`);
    await expect(page).toHaveURL(/#\/reglages$/);
    const card = page.locator('.settings-card', { hasText: 'Google Drive' });
    await expect(card.locator('.drive-status')).toContainText('Synchronisé à l’instant');
    expect(drive.puts).toBe(1);
  });

  test('an answer that is not the one asked for is refused', async ({ page }) => {
    await page.goto('/#access_token=vol&expires_in=3599&state=inconnu');
    await expect(page).toHaveURL(/#\/$/);
    await page.goto('#/reglages');
    await expect(page.locator('.settings-card', { hasText: 'Google Drive' })).toContainText('Réponse de Google inattendue');
    await expect(page.getByRole('button', { name: 'Connecter Google Drive' })).toBeVisible();
  });
});

test.describe('lasting connection (the app\u2019s Vercel function keeps the authorization)', () => {
  const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

  test('connecting asks Google once for a lasting authorization, then exchanges it', async ({ page }) => {
    const calls: string[] = [];
    await page.route('**/api/drive-token', async r => {
      if (r.request().method() === 'GET') return r.fulfill({ json: { ready: true } });
      const b = r.request().postDataJSON();
      calls.push(b.action);
      if (b.action === 'exchange') {
        expect(b.code).toBe('code-de-google');
        expect(b.redirect_uri).toMatch(/^http:\/\/localhost:\d+\/$/);
        return r.fulfill({ json: { access_token: 'jeton', expires_in: 3599, scope: SCOPE, lasting: true } });
      }
      return r.fulfill({ status: 401, json: { error: 'no_session' } });
    });
    let asked: URL | null = null;
    await page.route('https://accounts.google.com/gsi/**', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.route('https://accounts.google.com/o/oauth2/**', r => { asked = new URL(r.request().url()); return r.fulfill({ contentType: 'text/html', body: '<p>Google</p>' }); });
    const drive = fakeDrive();
    await drive.attach(page);
    await page.addInitScript(() => { (window as unknown as { __riffboxFakeDriveAuth: boolean }).__riffboxFakeDriveAuth = true; });

    await page.goto('#/reglages');
    await page.getByRole('button', { name: 'Connecter Google Drive' }).click();
    await expect.poll(() => asked?.pathname).toBe('/o/oauth2/v2/auth');
    const q = asked!.searchParams;
    expect([q.get('response_type'), q.get('access_type'), q.get('prompt')]).toEqual(['code', 'offline', 'consent']);

    await page.goto(`/?state=${q.get('state')}&code=code-de-google&scope=${encodeURIComponent(SCOPE)}`);
    await expect(page).toHaveURL(/\/#\/reglages$/);
    await expect(page.locator('.drive-status')).toContainText('Synchronisé à l’instant');
    expect(calls).toContain('exchange');
    expect(drive.puts).toBe(1);
  });

  test('an expired authorization is renewed without asking: changes keep travelling', async ({ page }) => {
    let refreshes = 0;
    await page.route('**/api/drive-token', r => {
      if (r.request().method() === 'GET') return r.fulfill({ json: { ready: true } });
      refreshes++;
      return r.fulfill({ json: { access_token: 'neuf', expires_in: 3599 } });
    });
    const drive = fakeDrive();
    await drive.attach(page);
    await page.addInitScript(() => {
      if (sessionStorage.getItem('prepared')) return;
      sessionStorage.setItem('prepared', '1');
      (window as unknown as { __riffboxFakeDriveAuth: boolean }).__riffboxFakeDriveAuth = true;
      localStorage.setItem('riffbox-drive-state', JSON.stringify({ connected: true, status: 'needsTap' }));
      // The hour is over.
      localStorage.setItem('riffbox-drive-token', JSON.stringify({ access_token: 'vieux', expires_at: Date.now() - 1000 }));
    });
    await page.goto('#/reglages');
    await expect(page.locator('.drive-status')).toContainText('Synchronisé à l’instant');
    expect(refreshes).toBe(1);
    expect(drive.puts).toBe(1);

    // A change goes a few seconds later, still without any sign-in.
    await page.goto('#/scene/morceau/s3');
    await page.locator('.chordpro').fill('{c:Couplet}\n[A7]Changée plus tard');
    await expect.poll(() => drive.puts, { timeout: 10_000 }).toBe(2);
  });
});
