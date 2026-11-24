import { button, expect, test } from './helpers';

const SONG = `Fil d’argent

G          D          Em
Sur la route au petit jour
C            G        D
Je reviens chanter l’amour`;

test('search on the web, copy the song, paste it from the clipboard: a ChordPro song named after the search', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await context.route('https://www.google.com/**', r => r.fulfill({ contentType: 'text/html', body: '<p>Résultats</p>' }));
  await page.goto('#/scene/morceaux');
  await button(page, 'Chercher…').click();
  const sheet = page.getByRole('dialog', { name: 'Chercher un morceau sur le web' });
  await sheet.getByLabel('Titre du morceau').fill('Fil d’argent');
  await sheet.getByLabel('Artiste').fill('Les Cordes');
  const [web] = await Promise.all([context.waitForEvent('page'), sheet.getByRole('button', { name: 'Chercher dans le navigateur' }).click()]);
  const q = new URL(web.url()).searchParams.get('q');
  expect(q).toBe('"Fil d’argent" Les Cordes accords paroles');
  await web.close();

  // Copied on the site, back in RIFFBOX.
  await page.evaluate(t => navigator.clipboard.writeText(t), SONG.split('\n').slice(2).join('\n')); // without its title line
  await sheet.getByRole('button', { name: 'Coller depuis le presse-papiers' }).click();
  const paste = page.getByRole('dialog', { name: 'Coller un morceau' });
  await expect(paste.getByLabel('Texte du morceau')).toHaveValue(/Sur la route au petit jour/);
  await expect(paste).toContainText('Pour : Fil d’argent · Les Cordes');
  await paste.getByRole('button', { name: 'Convertir' }).click();
  const found = page.getByRole('dialog', { name: 'Importer des morceaux' });
  await expect(found.locator('.song-title')).toHaveText('Fil d’argent');
  await expect(found.locator('.song-meta')).toContainText('Les Cordes');
  await found.getByRole('button', { name: /Aperçu/ }).click();
  await expect(found).toContainText('G Sur la rout'); // chords placed above their syllables
  await found.getByRole('button', { name: 'Importer 1 morceau' }).click();
  await expect(page.locator('.lib-row', { hasText: 'Fil d’argent' })).toBeVisible();
});

test('a song shared from another app (Android « Partager → RIFFBOX ») opens ready to import', async ({ page }) => {
  await page.goto(`/share-target?title=${encodeURIComponent('Page de grilles')}&text=${encodeURIComponent(SONG)}`);
  await expect(page).toHaveURL(/\/#\/scene\/morceaux$/);
  const paste = page.getByRole('dialog', { name: 'Coller un morceau' });
  await expect(paste.getByLabel('Texte du morceau')).toHaveValue(/^Fil d’argent/);
  await paste.getByRole('button', { name: 'Convertir' }).click();
  await expect(page.getByRole('dialog', { name: 'Importer des morceaux' }).locator('.song-title')).toHaveText('Fil d’argent');
});

test('a shared page address alone explains how to share the song itself', async ({ page }) => {
  await page.goto(`/share-target?title=x&text=${encodeURIComponent('https://exemple.org/grille')}`);
  await expect(page.locator('.cp-msg.error')).toContainText('pas la chanson');
  await expect(page.getByRole('dialog', { name: 'Coller un morceau' })).toHaveCount(0);
});

test('the browser refuses the clipboard: how to paste by hand', async ({ page }) => {
  await page.goto('#/scene/morceaux');
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { value: { readText: () => Promise.reject(new Error('non')) } }); });
  await button(page, 'Coller…').click();
  const paste = page.getByRole('dialog', { name: 'Coller un morceau' });
  await paste.getByRole('button', { name: 'Coller depuis le presse-papiers' }).click();
  await expect(paste.locator('.cp-msg.error')).toContainText('touchez longuement le cadre');
});

test('a whole Ultimate Guitar page copied (« Tout sélectionner »): only the song is imported, with its title, artist and capo', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const whole = ['ULTIMATE GUITAR', 'Log in', 'Sign up', 'Tabs', 'Courses',
    "Fil d'argent Chords by Les Cordes", 'Difficulty: novice', 'Key: Em', 'Capo: 2nd fret', 'Chords', 'Em C G D', 'Strumming', 'X',
    '[Verse 1]', 'Em           C', 'Sur la route au petit jour', 'G              D', "Je reviens chanter l'amour",
    '', 'X', 'Autoscroll', 'Transpose', 'Rating', 'Comments', 'super tab merci !!', 'Related tabs', 'Welcome offer'].join('\n');
  await page.goto('#/scene/morceaux');
  await page.evaluate(t => navigator.clipboard.writeText(t), whole);
  await button(page, 'Coller…').click();
  const paste = page.getByRole('dialog', { name: 'Coller un morceau' });
  await paste.getByRole('button', { name: 'Coller depuis le presse-papiers' }).click();
  await paste.getByRole('button', { name: 'Convertir' }).click();
  const found = page.getByRole('dialog', { name: 'Importer des morceaux' });
  await expect(found.locator('.song-title')).toHaveText("Fil d'argent");
  await expect(found.locator('.song-meta')).toContainText('Les Cordes');
  await found.getByRole('button', { name: 'Importer 1 morceau' }).click();
  await page.locator('.lib-row', { hasText: "Fil d'argent" }).click();
  const cp = await page.locator('.chordpro').inputValue();
  const saved = await page.evaluate(() => (JSON.parse(localStorage.getItem('riffbox:v1:songs') ?? '[]') as { title: string; capo: number; artist?: string }[])
    .find(x => x.title === "Fil d'argent"));
  expect(saved).toMatchObject({ capo: 2, artist: 'Les Cordes' }); // the page's capo becomes the song's
  expect(cp).toContain('[Em]Sur la route [C]au petit jour');
  expect(cp).not.toMatch(/ULTIMATE|Autoscroll|Comments|Welcome/);
});
