import { button, expect, fakeMic, guitarString, test, texts } from './helpers';

test.use(fakeMic(guitarString('carnet-mic', 196)));

const card = (page: import('@playwright/test').Page, title: string) =>
  page.locator('.idea', { has: page.locator('.idea-title', { hasText: new RegExp('^' + title + '$') }) });

test('filters by type, style and key', async ({ page }) => {
  await page.goto('#/composer');
  await expect(page.locator('.idea')).toHaveCount(8);
  await page.locator('.kind-chip', { hasText: 'Riffs' }).click();
  await expect(page.locator('.idea')).toHaveCount(3);
  await page.locator('.fsel select').nth(1).selectOption('Funk');
  await expect(page.locator('.idea-title')).toHaveText(['Funk en Mi m, 16e']);
  await page.locator('.fsel select').nth(1).selectOption('');
  await page.locator('.kind-chip', { hasText: 'Tout' }).click();
  await page.locator('.fsel select').nth(0).selectOption('La');
  expect(await texts(page, '.idea-title')).toEqual(expect.arrayContaining(['Riff shuffle en La', 'Minuit Shuffle']));
});

test('plays an example and opens a grid', async ({ page }) => {
  await page.goto('#/composer');
  await card(page, 'Riff shuffle en La').locator('.idea-play').click();
  await expect(card(page, 'Riff shuffle en La').locator('.wave span.played').first()).toBeVisible();
  await card(page, 'Minuit Shuffle').locator('.idea-top').click();
  await page.getByText('Ouvrir la grille ›').click();
  await expect(page).toHaveURL(/#\/composer\/grille\/g-minuit$/);
});

test('records from “+ Idée”, keeps the recording after a reload, and deletes it', async ({ page }) => {
  await page.goto('#/');
  await page.locator('.fab').click();
  await expect(page).toHaveURL(/#\/composer$/);
  await expect(page.locator('.rec-time')).toHaveText(/0:0[1-9]/, { timeout: 5000 });
  await page.getByText('■ Arrêter et ranger').click();
  const title = page.locator('.idea-title').first();
  await expect(title).toHaveText(/^Mémo du /);
  await expect(page.locator('.idea-meta').first()).toHaveText(/Mémo vocal · aujourd’hui · 0:0\d/);

  await page.reload();
  await page.locator('.kind-chip', { hasText: 'Tout' }).click();
  await page.locator('.idea-play').first().click();
  await expect(page.locator('.idea-play.on')).toHaveCount(1);

  await page.locator('.idea-top').first().click();
  page.once('dialog', d => d.accept());
  await button(page, 'Supprimer').click();
  await expect(page.locator('.idea-title').first()).not.toHaveText(/^Mémo du /);
  await page.goto('#/');
  await expect(page.locator('[data-tile="carnet"] .pedal-sub')).toHaveText('8 idées');
});

test('cancelling a recording keeps nothing', async ({ page }) => {
  await page.goto('#/composer');
  await page.locator('.rec-cta').click();
  await expect(page.locator('.rec-sheet')).toBeVisible();
  await button(page, 'Annuler').click();
  await expect(page.locator('.idea')).toHaveCount(8);
});
