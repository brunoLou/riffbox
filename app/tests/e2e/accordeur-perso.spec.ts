import { button, expect, fakeMic, guitarString, test } from './helpers';

// The microphone plays a D4 (293.66 Hz): in standard tuning that is no open string.
test.use(fakeMic(guitarString('re4', 293.66)));

test('create a custom tuning, tune to it, rename it, and delete it', async ({ page }) => {
  await page.goto('#/accordeur');
  await expect(page.locator('.readout-cents')).toHaveText(/^−?-?\d+ ct ↑$/); // E4 is the nearest string, far off

  // New tuning, starting from the current one (standard).
  await button(page, '+ Perso').click();
  const sheet = page.getByRole('dialog', { name: 'Nouvel accordage' });
  await expect(sheet.locator('.tuning-input')).toHaveAttribute('placeholder', 'EADGBE');
  await expect(sheet.locator('.tuning-same')).toHaveText('Changez au moins une corde : l’accordage part de « Standard ».');
  await expect(button(page, 'Enregistrer')).toBeDisabled();
  await sheet.getByLabel('Corde 1 : baisser d’un demi-ton').click();
  await sheet.getByLabel('Corde 1 : baisser d’un demi-ton').click();
  const s1 = sheet.locator('[data-string="1"]');
  await expect(s1.locator('.tuning-note b')).toHaveText('D4');
  await expect(s1.locator('.tuning-diff')).toHaveText('−2');
  await expect(sheet.locator('.tuning-input')).toHaveAttribute('placeholder', 'EADGBD');
  await sheet.locator('.tuning-input').fill('Ré en haut');
  await button(page, 'Enregistrer').click();
  await expect(sheet).toHaveCount(0);

  // The tuner now aims at the custom tuning: the D4 is string 1, in tune.
  await expect(page.locator('.preset.on-cream')).toHaveText('Ré en haut ✎');
  await expect(page.locator('.tuning-notes')).toContainText('EADGBD');
  await expect(page.locator('.note-big')).toHaveText('D');
  await expect(page.locator('.readout-cents')).toHaveText(/^[+−-]?[0-3] ct$/);
  await expect(page.locator('.string-btn.on-amber .string-num')).toHaveText('1');

  // Remembered, and shown on the home tile.
  await page.reload();
  await expect(page.locator('.preset.on-cream')).toHaveText('Ré en haut ✎');
  await page.goto('#/');
  await expect(page.locator('[data-tile="tuner"] .pedal-sub')).toHaveText('Chromatique · Ré en haut');

  // Editing into an existing tuning offers that one instead of a duplicate.
  await page.goto('#/accordeur');
  await page.locator('.preset.on-cream').click();
  const edit = page.getByRole('dialog', { name: 'Modifier l’accordage' });
  await expect(button(page, 'Enregistrer les modifications')).toBeDisabled(); // nothing changed yet
  for (let i = 0; i < 2; i++) await edit.getByLabel('Corde 6 : baisser d’un demi-ton').click();
  for (let i = 0; i < 2; i++) await edit.getByLabel('Corde 2 : baisser d’un demi-ton').click();
  await expect(edit.locator('.tuning-same')).toHaveText('Mêmes notes que « DADGAD ».');
  await button(page, 'Utiliser « DADGAD »').click();
  await expect(page.locator('.preset.on-cream')).toHaveText('DADGAD');
  await expect(page.locator('.preset-custom')).toHaveText(['Ré en haut']); // left as it was

  // Delete (two steps): back to standard.
  await page.locator('.preset-custom').click();
  await page.locator('.preset-custom').click();
  await button(page, 'Supprimer cet accordage').click();
  await button(page, 'Supprimer « Ré en haut »').click();
  await expect(page.locator('.preset-custom')).toHaveCount(0);
  await expect(page.locator('.preset.on-cream')).toHaveText('Standard');
});

test('the editor warns about extra tension, shifts the whole neck, and closes without saving', async ({ page }) => {
  await page.goto('#/accordeur');
  await page.locator('.preset', { hasText: 'Drop C' }).click();
  await button(page, '+ Perso').click();
  const sheet = page.getByRole('dialog', { name: 'Nouvel accordage' });
  await expect(sheet.locator('.tuning-input')).toHaveAttribute('placeholder', 'CGCFAD');
  await button(page, 'Tout +½ ton').click();
  await button(page, 'Tout +½ ton').click();
  await expect(sheet.locator('.tuning-same')).toHaveText('Mêmes notes que « Drop D ».');
  await button(page, 'Tout +½ ton').click();
  await button(page, 'Tout +½ ton').click();
  await expect(sheet.locator('.tuning-warn')).toBeVisible();
  await expect(sheet.locator('.tuning-string.tight')).toHaveCount(5);
  // Up to a minor third above standard, no more.
  await button(page, 'Tout +½ ton').click();
  await expect(sheet.locator('[data-string="5"] .tuning-diff')).toHaveText('+3');
  await expect(button(page, 'Tout +½ ton')).toBeDisabled();
  await sheet.getByLabel('Fermer').click();
  await expect(page.locator('.preset-custom')).toHaveCount(0);
  await expect(page.locator('.preset.on-cream')).toHaveText('Drop C');
});
