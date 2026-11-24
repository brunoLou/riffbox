import { readFileSync } from 'node:fs';
import { button, expect, guitarString, test } from './helpers';

const wav = () => readFileSync(guitarString('relever', 220));

test('relever: a recording slowed down, a passage looped from A to B, transposed; kept for next time', async ({ page }) => {
  await page.goto('#/pratiquer');
  await page.getByRole('button', { name: /^Relever/ }).click();
  await expect(page).toHaveURL(/#\/pratiquer\/relever$/);
  await page.getByLabel('Enregistrement à relever').setInputFiles({ name: 'Mon solo.wav', mimeType: 'audio/wav', buffer: wav() });
  await expect(page.locator('.rv-title b')).toHaveText('Mon solo');
  // The loudness overview, from the decoded file.
  await expect.poll(() => page.locator('.rv-bars span').evaluateAll(s => s.filter(x => parseFloat((x as HTMLElement).style.height) > 50).length)).toBeGreaterThan(20);

  // Slower, without changing the pitch.
  await page.getByRole('group', { name: 'Vitesse' }).getByRole('button', { name: '70 %' }).click();
  await expect(page.getByRole('region', { name: 'Vitesse' }).locator('.kicker')).toHaveText('Vitesse · 70 %');

  // A passage from 0:00 to about 0:01, played in a loop.
  await page.getByRole('button', { name: /^Début de la boucle/ }).click();
  await page.getByRole('slider', { name: 'Position dans le morceau' }).click({ position: { x: 60, y: 40 } });
  await page.getByRole('button', { name: /^Fin de la boucle/ }).click();
  await expect(page.locator('.rv-loop')).toBeVisible();
  await button(page, 'LECTURE').click();
  await expect(button(page, 'PAUSE')).toBeVisible();
  // Over three seconds the playhead never goes past B.
  const b = await page.evaluate(() => JSON.parse(localStorage.getItem('riffbox:v1:relever.track')!).b as number);
  let max = 0;
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(250);
    max = Math.max(max, Number(await page.getByRole('slider', { name: 'Position dans le morceau' }).getAttribute('aria-valuenow')));
  }
  expect(max).toBeLessThanOrEqual(Math.ceil(b));

  // Transposed a semitone down (a guitar tuned to E♭).
  await page.getByRole('button', { name: 'Un demi-ton plus bas' }).click();
  await expect(page.getByRole('region', { name: 'Transposition' }).locator('.stepper .mono')).toHaveText('-1');
  await page.waitForTimeout(300);
  await expect(page.locator('.cp-msg')).toHaveCount(0); // the transposer runs in this browser
  await button(page, 'PAUSE').click();

  // Next time: the same recording, speed, loop and key.
  await page.reload();
  await expect(page.locator('.rv-title b')).toHaveText('Mon solo');
  await expect(page.getByRole('region', { name: 'Vitesse' }).locator('.kicker')).toHaveText('Vitesse · 70 %');
  await expect(page.locator('.rv-loop')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Transposition' }).locator('.stepper .mono')).toHaveText('-1');
});

test('relever: something that is not a sound is refused', async ({ page }) => {
  await page.goto('#/pratiquer/relever');
  await page.getByLabel('Enregistrement à relever').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('bonjour') });
  await expect(page.locator('.cp-msg.error')).toContainText('pas un son lisible');
});
