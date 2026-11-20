import { button, expect, test } from './helpers';

test('the practice routine runs, moves on by itself and finishes', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-20T10:00:00') });
  await page.goto('#/');
  await expect(page.locator('.resume-sub')).toHaveText('Routine · étape 3/4 · 4 min');
  await page.getByRole('link', { name: 'Pratiquer' }).click();
  await expect(page.locator('.week-col')).toHaveCount(7);
  await page.locator('.routine-go').click();
  await expect(page).toHaveURL(/#\/pratiquer\/routine$/);
  await button(page, 'GO').click();
  await page.clock.runFor(61_000);
  await expect(page.locator('.rring-time')).toHaveText('2:59');
  await page.clock.runFor(180_000);
  await expect(page.locator('.rring-name')).toHaveText('Impro');
  // The timer keeps running while the backing track screen is open.
  await page.getByText('Lancer le backing ›').click();
  await page.clock.runFor(8 * 60_000 + 2_000);
  await page.goto('#/pratiquer/routine');
  await expect(page.locator('.display').first()).toHaveText('TERMINÉE');
  await page.goto('#/');
  await expect(page.locator('.resume-title')).toHaveText('Routine du jour terminée');
});

test('the week chart shows a day when touched', async ({ page }) => {
  await page.goto('#/pratiquer');
  await expect(page.locator('.week-foot')).toContainText('(aujourd’hui)');
  await page.locator('.week-col').nth(3).click();
  await expect(page.locator('.week-foot')).toHaveText(/^\S+ · 41 min · objectif atteint$/);
});

test('backing tracks play, follow the bars and change key and tempo live', async ({ page }) => {
  await page.goto('#/pratiquer/backing');
  await expect(page.locator('.track')).toHaveCount(7);
  await page.locator('.seg button', { hasText: 'Funk' }).click();
  await expect(page.locator('.track')).toHaveCount(2);
  await page.locator('.seg button', { hasText: 'Tous' }).click();
  await page.getByLabel('Lire Blues en La').click();
  await expect(page.locator('.player-next .mono')).toHaveText('Mesure 2/12', { timeout: 6000 });
  await expect(page.locator('.player-chord')).toHaveText('D7');
  await page.getByLabel('Monter d’un demi-ton').click();
  await page.getByLabel('Accélérer').click();
  await expect(page.locator('.player-ctrls .mono')).toHaveText(['Si♭', '92']);
  await page.getByLabel('Fermer le lecteur').click();
  await expect(page.locator('.player')).toHaveCount(0);
});
