import { button, expect, test } from './helpers';

test('concert sheet: a memo per song (shown on stage), gaps and start times, a checklist', async ({ page }) => {
  await page.goto('#/scene/bar-du-port');
  await button(page, 'Modifier').click();
  await page.getByLabel('Mémo pour Réveil électrique').fill('Capo 0 · overdrive · Léa compte l’intro');
  await page.getByLabel('Temps entre deux morceaux').selectOption('60');
  // Checklist: one removed, one added.
  const check = page.getByRole('region', { name: 'Avant de monter sur scène' });
  await check.getByRole('button', { name: 'Retirer « De l’eau »' }).click();
  await check.getByLabel('Nouvelle chose à vérifier').fill('Capo dans la poche');
  await check.getByRole('button', { name: 'Ajouter' }).click();
  await button(page, 'Terminé').click();

  const first = page.locator('.song-row').first();
  await expect(first.locator('.song-memo')).toHaveText('Capo 0 · overdrive · Léa compte l’intro');
  await expect(page.locator('.set-info')).toContainText('avec les enchaînements');
  // The second song starts after the first one and a minute's gap (the set has a date).
  const at = await page.locator('.song-at').allTextContents();
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  expect(mins(at[1]) - mins(at[0])).toBe(Math.floor((200 + 60) / 60)); // Réveil électrique: 3:20

  await expect(check.locator('.set-check-row')).toHaveCount(6);
  await check.getByLabel('Accorder toutes les guitares').check();
  await check.getByLabel('Capo dans la poche').check();
  await expect(check.locator('.set-check-head .mono')).toHaveText('2/6');
  await page.reload();
  await expect(check.locator('.set-check-head .mono')).toHaveText('2/6');
  await check.getByRole('button', { name: 'Tout décocher (prochain concert)' }).click();
  await expect(check.locator('.set-check-head .mono')).toHaveText('0/6');

  // On stage, the memo is above the lyrics.
  await button(page, '▶  Jouer le set').click();
  await expect(page.getByLabel('Mémo')).toHaveText('Capo 0 · overdrive · Léa compte l’intro');
});
