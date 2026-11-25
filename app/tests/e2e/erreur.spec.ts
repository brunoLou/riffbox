import { expect, test } from '@playwright/test';

test('damaged data of the wrong shape is ignored: the screens still open', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('riffbox:v1:songs', JSON.stringify({ pas: 'une liste' })));
  await page.goto('#/scene/morceaux');
  await expect(page.locator('.lib-row').first()).toBeVisible(); // the example songs
  await page.goto('#/');
  await expect(page.getByText('MON PEDALBOARD')).toBeVisible();
});

test('a screen that fails shows a message, its detail and a way out, not a blank page', async ({ page }) => {
  // The library fails on purpose (test switch).
  await page.addInitScript(() => sessionStorage.setItem('riffbox-test-crash', '/scene/morceaux'));
  page.on('pageerror', () => undefined);
  await page.goto('#/scene/morceaux');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Cet écran n’a pas pu s’afficher');
  await alert.locator('summary').click();
  await expect(alert.locator('.crash-detail')).toContainText('Échec volontaire (test)');
  await expect(alert.locator('.crash-detail')).toContainText('#/scene/morceaux');
  // Another screen still opens.
  await alert.getByRole('button', { name: 'Revenir à l’accueil' }).click();
  await expect(page.getByText('MON PEDALBOARD')).toBeVisible();
});
