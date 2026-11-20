import { button, expect, test } from './helpers';

test('knob, tap tempo, signatures, grooves and live beat', async ({ page }) => {
  await page.goto('#/metronome');
  const val = page.locator('.tknob-val');
  await expect(val).toHaveText('92');

  // Drag the knob up 60 px = +20 BPM.
  const k = (await page.locator('.tknob').boundingBox())!;
  await page.mouse.move(k.x + k.width / 2, k.y + k.height / 2);
  await page.mouse.down();
  await page.mouse.move(k.x + k.width / 2, k.y + k.height / 2 - 60, { steps: 6 });
  await page.mouse.up();
  await expect(val).toHaveText('112');
  await page.getByLabel('Plus 1 BPM').click();
  await expect(val).toHaveText('113');


  await page.locator('.sig-chip', { hasText: '3/4' }).click();
  await expect(page.locator('.beat-lamp')).toHaveCount(3);
  await page.locator('.groove', { hasText: 'Funk' }).click();
  await expect(page.locator('.metro-sig')).toHaveText('4/4');
  await expect(page.locator('.seg button').first()).toBeDisabled();

  await page.getByRole('button', { name: /Lecture/ }).click();
  await expect(page.locator('.beat-lamp.lit')).toHaveCount(1);
  await button(page, 'Arrêter').click();
  await expect(page.locator('.beat-lamp.lit')).toHaveCount(0);

  await page.getByLabel('Retour').click();
  await expect(page.locator('[data-tile="metro"] .pedal-sub')).toHaveText(/BPM · 4\/4/);
});

test('beats can be accented', async ({ page }) => {
  await page.goto('#/metronome');
  await page.getByLabel('Temps 3').click();
  await expect(page.getByLabel('Temps 3, accentué')).toHaveAttribute('aria-pressed', 'true');
});

test('tap tempo averages the last taps', async ({ page }) => {
  // A controlled clock makes the taps exactly 500 ms apart.
  await page.clock.install({ time: new Date('2026-11-20T10:00:00') });
  await page.goto('#/metronome');
  await page.clock.pauseAt(new Date('2026-11-20T10:01:00'));
  for (let i = 0; i < 4; i++) { await page.locator('.tap').dispatchEvent('pointerdown'); await page.clock.runFor(500); }
  await expect(page.locator('.tknob-val')).toHaveText('120');
  // A pause longer than 2 s starts a new measure.
  await page.clock.runFor(3000);
  for (let i = 0; i < 3; i++) { await page.locator('.tap').dispatchEvent('pointerdown'); await page.clock.runFor(750); }
  await expect(page.locator('.tknob-val')).toHaveText('80');
});
