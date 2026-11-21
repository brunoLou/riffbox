import { button, expect, test } from './helpers';

test('design system: from Réglages, colours with their values in both themes, live components', async ({ page }) => {
  await page.goto('#/reglages');
  await page.getByRole('link', { name: /Design system/ }).click();
  await expect(page).toHaveURL(/#\/reglages\/design$/);

  // Every colour token, with the value it has in the theme being previewed.
  const canvas = page.locator('[data-token="canvas"] .ds-hex');
  await expect(canvas).toHaveText('#11100f');
  await expect(page.locator('[data-token]')).toHaveCount(25);
  await page.getByRole('group', { name: 'Thème de l’aperçu' }).getByRole('button', { name: 'Clair' }).click();
  await expect(canvas).toHaveText('#e7e0d4');
  await expect(page.locator('[data-token="acc-good"] .ds-hex')).toHaveText('#1d8a4b');
  // Only the preview changes: the app keeps its own theme.
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');

  // The real components.
  await expect(page.getByRole('region', { name: 'Tuile-pédale' }).locator('[data-tile]')).toHaveCount(5);
  const knob = page.getByRole('region', { name: 'Bouton rotatif' });
  await knob.getByRole('slider').focus();
  await page.keyboard.press('ArrowUp');
  await expect(knob.locator('.ds-desc')).toContainText('Ici : 93 BPM.');
  const sw = page.getByRole('region', { name: 'Interrupteur et voyants' }).getByRole('button', { name: /Interrupteur/ });
  await sw.click();
  await expect(sw).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('region', { name: 'Diagramme d’accord' }).locator('svg')).toHaveCount(2);
  await expect(page.getByRole('region', { name: 'Carte d’idée' }).locator('.wave span.played').first()).toBeVisible();
  await button(page, 'Retour').click();
  await expect(page).toHaveURL(/#\/reglages$/);
});
