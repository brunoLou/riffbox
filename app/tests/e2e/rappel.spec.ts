import { button, expect, test } from './helpers';

const DAY = 86400000;
const T0 = new Date('2026-11-01T10:00:00').getTime();
const nudge = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'Rappel de sauvegarde' });

async function newSetlist(page: import('@playwright/test').Page) {
  await page.goto('#/scene');
  await page.getByText('+ Nouvelle setlist').click();
  await page.locator('.set-title-input').fill('Mon set');
  await button(page, 'Terminé').click();
}

test('only the examples: never a reminder', async ({ page }) => {
  await page.clock.install({ time: T0 });
  await page.goto('#/');
  await page.clock.setSystemTime(T0 + 60 * DAY);
  await page.reload();
  await expect(page.locator('.tile, [data-tile]').first()).toBeVisible();
  await expect(nudge(page)).toHaveCount(0);
});

test('own content without a backup: reminded after two weeks, « Plus tard » waits a week, saving stops it', async ({ page }) => {
  await page.clock.install({ time: T0 });
  await newSetlist(page);
  await page.goto('#/');
  await expect(page.locator('[data-tile]').first()).toBeVisible();
  await expect(nudge(page)).toHaveCount(0); // just created

  await page.clock.setSystemTime(T0 + 15 * DAY);
  await page.reload();
  await expect(nudge(page)).toContainText('Aucune sauvegarde pour l’instant');

  await button(page, 'Plus tard').click();
  await expect(nudge(page)).toHaveCount(0);
  await page.clock.setSystemTime(T0 + 20 * DAY);
  await page.reload();
  await expect(page.locator('[data-tile]').first()).toBeVisible();
  await expect(nudge(page)).toHaveCount(0); // still snoozed
  await page.clock.setSystemTime(T0 + 23 * DAY);
  await page.reload();
  await expect(nudge(page)).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent('download'), button(page, 'Sauvegarder').click()]);
  expect(download.suggestedFilename()).toMatch(/^riffbox-sauvegarde-.*\.json$/);
  await expect(page.locator('.backup-nudge-done')).toHaveText('Sauvegarde faite. Gardez le fichier hors du téléphone.');
  await page.reload();
  await expect(page.locator('[data-tile]').first()).toBeVisible();
  await expect(nudge(page)).toHaveCount(0);
  await page.goto('#/reglages');
  await expect(page.locator('.settings-help', { hasText: 'Dernière sauvegarde' })).toContainText('(aujourd’hui)');

  // Two weeks after that backup, the reminder counts from it.
  await page.clock.setSystemTime(T0 + 38 * DAY + 3600000);
  await page.goto('#/');
  await page.reload();
  await expect(nudge(page)).toContainText('Dernière sauvegarde il y a 15 jours');
});

test('the reminder interval can be changed or turned off in Réglages', async ({ page }) => {
  await page.clock.install({ time: T0 });
  await newSetlist(page);
  await page.goto('#/');
  await page.goto('#/reglages');
  await page.getByRole('group', { name: 'Rappel de sauvegarde' }).getByRole('button', { name: '1 semaine' }).click();
  await page.clock.setSystemTime(T0 + 8 * DAY);
  await page.goto('#/');
  await page.reload();
  await expect(nudge(page)).toBeVisible();
  await page.goto('#/reglages');
  await page.getByRole('group', { name: 'Rappel de sauvegarde' }).getByRole('button', { name: 'Jamais' }).click();
  await expect(page.locator('.settings-help', { hasText: 'Aucun rappel.' })).toBeVisible();
  await page.goto('#/');
  await page.reload();
  await expect(page.locator('[data-tile]').first()).toBeVisible();
  await expect(nudge(page)).toHaveCount(0);
});
