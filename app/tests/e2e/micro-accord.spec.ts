import { button, expect, fakeMic, strummedChords, test } from './helpers';

const EM = [40, 47, 52, 55, 59, 64];

test.use(fakeMic(strummedChords('micro-em', Array(8).fill(EM), 1.5)));
test('names the chord', async ({ page }) => {
  await page.goto('#/reglages/micro');
  await button(page, '🎙 Commencer le test').click();
  await expect(page.locator('.mic-check.ok', { hasText: 'Accord reconnu sans saturer : Em' })).toBeVisible({ timeout: 12000 });
});
