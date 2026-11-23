import { expect, test } from './helpers';

const strip = (page: import('@playwright/test').Page) => page.locator('.stage-chords');

test('prompter: diagrams of the chord now and the next one follow the reading, and can be hidden', async ({ page }) => {
  // A long song: the chords change further down.
  await page.goto('#/scene/morceau/s3');
  const top = Array.from({ length: 14 }, (_, i) => `[G]Ligne ${i + 1} du [D]début`).join('\n');
  await page.locator('.chordpro').fill(`{c:Couplet}\n${top}\n{c:Refrain}\n[Am]Tout en [F]bas\n[Am]Encore [F]plus bas`);
  await page.goto('#/scene/repet-jeudi/play/0');

  await expect(strip(page)).toHaveAttribute('aria-label', 'Accord : G, ensuite D');
  await expect(strip(page).locator('.sc-chord.now .sc-name')).toHaveText('G');
  await expect(strip(page).locator('.sc-chord.now .chord-svg')).toBeVisible();
  await expect(strip(page).locator('.sc-chord.next .sc-name')).toHaveText('D');

  // Scrolled to the end: the chords of the last lines.
  await page.locator('.lyrics').evaluate(el => { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll')); });
  await expect(strip(page).locator('.sc-chord.now .sc-name')).toHaveText(/Am|F/);
  await expect(strip(page)).not.toHaveAttribute('aria-label', /Accord : G/);

  // « Schémas » hides the strip, and the choice is remembered.
  const toggle = page.getByRole('button', { name: 'Schémas' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(strip(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Schémas' })).toHaveAttribute('aria-pressed', 'false');
  await expect(strip(page)).toHaveCount(0);
});

test('prompter: written chords like C#m, Bbmaj7 or D/F# get their diagram', async ({ page }) => {
  await page.goto('#/scene/morceau/s3');
  await page.locator('.chordpro').fill('[C#m]Un [Bbmaj7]deux');
  await page.goto('#/scene/repet-jeudi/play/0');
  await expect(strip(page).locator('.sc-chord.now .sc-name')).toHaveText('C#m');
  await expect(strip(page).locator('.sc-chord.next .sc-name')).toHaveText('Bbmaj7');
  await expect(strip(page).locator('.chord-svg')).toHaveCount(2);
});
