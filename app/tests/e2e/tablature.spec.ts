import { expect, test } from './helpers';

test('a riff written in tab: cell by cell, named, shown as text, heard, edited again', async ({ page }) => {
  await page.goto('#/composer');
  await page.getByRole('button', { name: '+ Tab', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Tablature : Nouveau riff' });
  // Low E: 0 3 5, then the A string at step 4: 7. The cursor moves on by itself.
  for (const f of [0, 3, 5]) await sheet.getByRole('button', { name: `Case ${f}`, exact: true }).click();
  await sheet.getByRole('gridcell', { name: 'La, temps 4 : vide' }).click();
  await sheet.getByRole('button', { name: '+12' }).click();
  await sheet.getByRole('button', { name: 'Case 14', exact: true }).click(); // 2 + 12
  await sheet.getByRole('gridcell', { name: 'Mi aigu, temps 6 : vide' }).click();
  await sheet.getByRole('button', { name: 'Note étouffée' }).click();
  await expect(sheet.getByRole('gridcell', { name: 'La, temps 4 : case 14' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Enregistrer la tablature' }).click();

  // Named like any new idea, then shown in the notebook.
  const name = page.getByRole('dialog').filter({ has: page.locator('input.text-input') });
  await name.locator('input.text-input').fill('Riff en Mi');
  await name.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  const card = page.locator('.idea', { has: page.locator('.idea-title', { hasText: 'Riff en Mi' }) });
  await expect(card.locator('.tab-text')).toHaveText([
    'e|-----------------x-|',
    'B|-------------------|',
    'G|-------------------|',
    'D|-------------------|',
    'A|----------14-------|',
    'E|-0--3--5-----------|',
  ].join('\n'));
  await card.getByRole('button', { name: 'Écouter la tablature' }).click();
  await expect(card.getByRole('button', { name: 'Arrêter la tablature' })).toBeVisible();
  await card.getByRole('button', { name: 'Arrêter la tablature' }).click();

  // Edited later: a note cleared.
  if ((await card.locator('.idea-open').getAttribute('aria-expanded')) !== 'true') await card.locator('.idea-open').click();
  await card.getByRole('button', { name: 'Tablature', exact: true }).click();
  const again = page.getByRole('dialog', { name: 'Tablature : Riff en Mi' });
  await again.getByRole('gridcell', { name: 'Mi aigu, temps 6 : étouffée' }).click();
  await again.getByRole('button', { name: 'Effacer la case' }).click();
  await again.getByRole('button', { name: 'Enregistrer la tablature' }).click();
  await expect(card.locator('.tab-text')).not.toContainText('x');
  await page.reload();
  await expect(page.locator('.idea', { has: page.locator('.idea-title', { hasText: 'Riff en Mi' }) }).locator('.tab-text')).toContainText('A|----------14-|');
});
