import { button, clippedTone, expect, fakeMic, test } from './helpers';

test.use(fakeMic(clippedTone('micro-clip', 220)));
test('warns about clipping', async ({ page }) => {
  await page.goto('#/reglages/micro');
  await button(page, '🎙 Commencer le test').click();
  await expect(page.locator('.mic-verdict')).toHaveText('Saturé');
  await expect(page.locator('.mic-warn')).toContainText('Saturation détectée');
  await expect(page.locator('.mic-check:not(.ok)', { hasText: 'Le son a saturé' })).toBeVisible();
});
