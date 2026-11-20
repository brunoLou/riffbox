import { expect, fakeMic, guitarString, test } from './helpers';

// The microphone plays a low E string (82.41 Hz) 20 cents flat.
test.use(fakeMic(guitarString('mi-moins-20', 82.4069, -20)));

test('reads a low E 20 cents flat and picks string 6', async ({ page }) => {
  await page.goto('#/accordeur');
  await expect(page.locator('.readout-cents')).toHaveText(/^-(19|20|21) ct$/);
  await expect(page.locator('.note-big')).toHaveText('E');
  await expect(page.locator('.string-btn.on-amber .string-num')).toHaveText('6');
  await expect(page.locator('.led.on')).toHaveCount(0); // not in tune
});
