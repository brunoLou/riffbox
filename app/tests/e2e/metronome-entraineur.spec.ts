import { button, expect, test } from './helpers';

/** Counts the sounds the metronome makes (each click is an oscillator started). */
const countSounds = (page: import('@playwright/test').Page) => page.addInitScript(() => {
  const w = window as unknown as { __sounds: number[] };
  w.__sounds = [];
  const orig = AudioContext.prototype.createOscillator;
  AudioContext.prototype.createOscillator = function (this: AudioContext) { w.__sounds.push(performance.now()); return orig.call(this); };
});
const sounds = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { __sounds: number[] }).__sounds.length);

test('metronome trainer: the tempo rises bar after bar, then goes back to where it started', async ({ page }) => {
  await page.goto('#/metronome');
  await page.evaluate(() => localStorage.setItem('riffbox:v1:metro.bpm', '200'));
  await page.reload();
  const t = page.getByRole('region', { name: 'Entraîneur' });
  await t.getByLabel('Tempo qui monte').check();
  await t.getByLabel('Hausse du tempo').selectOption('10');
  await t.getByLabel('Toutes les combien de mesures').selectOption('1');
  await t.getByLabel('Tempo à atteindre').selectOption('230');
  await expect(t.locator('.trainer-set')).toContainText('de 200 jusqu’à');
  await page.locator('.cta').click();
  await expect(t.locator('.trainer-now')).toContainText('Mesure 4', { timeout: 10_000 });
  await expect(page.locator('.cta')).toHaveText('Arrêter');
  await expect.poll(() => page.getByRole('slider').first().getAttribute('aria-valuenow').catch(() => null)).not.toBe('200');
  await page.locator('.cta').click();
  await expect(page.locator('.cta')).toContainText('200 BPM'); // ready for the next run
});

test('metronome trainer: silent bars are really silent, and the click comes back', async ({ page }) => {
  await countSounds(page);
  await page.goto('#/metronome');
  await page.evaluate(() => localStorage.setItem('riffbox:v1:metro.bpm', '120')); // a bar: 2 s
  await page.reload();
  const t = page.getByRole('region', { name: 'Entraîneur' });
  await t.getByLabel('Mesures muettes').check();
  await t.getByLabel('Mesures jouées').selectOption('1');
  await t.getByLabel('Nombre de mesures muettes').selectOption('1');
  await page.locator('.cta').click();
  await expect(t.locator('.trainer-now')).toHaveText('Mesure 2 · silence, tenez le tempo !', { timeout: 6000 });
  await page.waitForTimeout(500);
  const before = await sounds(page);
  await page.waitForTimeout(900); // still within the silent bar
  expect(await sounds(page)).toBe(before);
  await expect(t.locator('.trainer-now')).toHaveText('Mesure 3', { timeout: 4000 });
  await page.waitForTimeout(600);
  expect(await sounds(page)).toBeGreaterThan(before); // the click is back
  await page.locator('.cta').click();
});
