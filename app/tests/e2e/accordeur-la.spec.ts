import { expect, fakeMic, guitarString, test } from './helpers';

// The microphone plays an A string (110 Hz) 10 cents sharp.
test.use(fakeMic(guitarString('la-plus-10', 110, 10)));

test('reads an A string 10 cents sharp and picks string 5', async ({ page }) => {
  await page.goto('#/accordeur');
  await expect(page.locator('.readout-cents')).toHaveText(/^\+(9|10|11) ct$/);
  await expect(page.locator('.note-big')).toHaveText('A');
  await expect(page.locator('.readout-hz')).toHaveText(/^110\.[5-8] Hz$/);
  await expect(page.locator('.string-btn.on-amber .string-num')).toHaveText('5');
  await expect(page.locator('.switch.on')).toHaveCount(1);
});

test('in manual mode it aims at the chosen string and shows which way to tune', async ({ page }) => {
  await page.goto('#/accordeur');
  await page.locator('.string-btn').first().click(); // low E
  await expect(page.locator('.switch.on')).toHaveCount(0);
  await expect(page.locator('.readout-cents')).toHaveText(/^\+5\d\d ct ↓$/);
});

test('the tuning and mode are remembered', async ({ page }) => {
  await page.goto('#/accordeur');
  await page.locator('.preset', { hasText: 'Drop D' }).click();
  await page.locator('.auto-toggle').click();
  await page.reload();
  await expect(page.locator('.preset.on-cream')).toHaveText('Drop D');
  await expect(page.locator('.switch.on')).toHaveCount(0);
});
