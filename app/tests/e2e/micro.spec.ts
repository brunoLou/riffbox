import { button, expect, fakeMic, guitarString, test } from './helpers';

test.use(fakeMic(guitarString('micro-la', 110)));
test('shows a good level, the note heard and ticks the checks', async ({ page }) => {
  await page.goto('#/reglages');
  await page.getByRole('link', { name: /Tester le micro/ }).click();
  await expect(page).toHaveURL(/#\/reglages\/micro$/);
  await button(page, '🎙 Commencer le test').click();
  await expect(page.locator('.mic-verdict')).toHaveText('Bon niveau');
  await expect(page.locator('.mic-check.ok', { hasText: 'Note seule reconnue : A2' })).toBeVisible();
  await expect(page.locator('.mic-check.ok', { hasText: 'Aucune saturation' })).toBeVisible();
  await expect(page.locator('.mic-bar.on b')).toContainText(['A']);
  await button(page, 'Arrêter le test').click();
  await expect(button(page, '🎙 Commencer le test')).toBeVisible();
});
test('tips follow the guitar chosen', async ({ page }) => {
  await page.goto('#/reglages/micro');
  await expect(page.locator('.mic-tips')).toContainText('rosace');
  await button(page, 'Électrique').click();
  await expect(page.locator('.mic-tips')).toContainText('interface audio USB');
  await page.reload();
  await expect(page.locator('.mic-tips')).toContainText('interface audio USB');
});
