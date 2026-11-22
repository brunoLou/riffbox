import { button, expect, fakeMic, guitarString, test } from './helpers';

test.use(fakeMic(guitarString('voyants-mic', 110)));

const lit = (page: import('@playwright/test').Page) =>
  page.locator('[data-tile]', { has: page.locator('.pedal-led.on') }).evaluateAll(els => els.map(e => e.getAttribute('data-tile')));

test('the LEDs show what was really used today, and go dark the next day', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-20T10:00:00') });
  await page.goto('#/');
  await expect(page.locator('[data-tile]').first()).toBeVisible();
  expect(await lit(page)).toEqual([]);

  // Opening the notebook is not using it; the metronome counts once started.
  await page.goto('#/composer');
  await page.goto('#/metronome');
  await page.locator('.cta').click();
  await page.locator('.cta').click();
  await page.goto('#/');
  expect(await lit(page)).toEqual(['metro']);
  await expect(page.locator('.led-legend')).toHaveText('Voyant allumé : outil utilisé aujourd’hui');
  await expect(page.locator('[data-tile="metro"]')).toContainText('utilisé aujourd’hui'); // for screen readers

  // A note heard by the tuner, a text written in the notebook, the scales looked at.
  await page.goto('#/accordeur');
  await expect(page.locator('.readout-hz')).toHaveText(/Hz/, { timeout: 8000 }); // a note was heard
  await page.goto('#/composer');
  await button(page, '+ Texte').click();
  await page.locator('textarea').fill('Une idée');
  await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await page.goto('#/pratiquer/gammes');
  await page.goto('#/');
  expect((await lit(page)).sort()).toEqual(['carnet', 'manche', 'metro', 'tuner']);

  // The next morning, everything is off.
  await page.clock.setSystemTime(new Date('2026-11-21T08:00:00'));
  await page.reload();
  await expect(page.locator('[data-tile]').first()).toBeVisible();
  expect(await lit(page)).toEqual([]);
});
