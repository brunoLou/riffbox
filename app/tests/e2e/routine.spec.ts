import { button, expect, test, texts } from './helpers';

test('edit the routine: lengths, names, a new step, order, removal; today’s time is kept', async ({ page }) => {
  // Example state: Échauffement (5 min) and Technique (8 min) done, on Gammes.
  await page.goto('#/pratiquer/routine');
  await expect(page.locator('.display').first()).toHaveText('ÉTAPE 3/4');
  await button(page, 'Modifier').click();
  await expect(page).toHaveURL(/routine\/modifier$/);
  await expect(button(page, 'Enregistrer')).toBeDisabled(); // nothing changed yet

  for (let i = 0; i < 2; i++) await page.getByLabel('Étape 1 : une minute de moins').click();
  await page.getByLabel('Nom de l’étape 4').fill('Impro funk');
  await button(page, '+ Ajouter une étape').click();
  await page.getByLabel('Nom de l’étape 5').fill('Accords');
  await page.getByLabel('Consigne de l’étape 5').fill('Enchaîner Am, C et G sans regarder. Puis au métronome.');
  for (let i = 0; i < 3; i++) await page.getByLabel('Étape 5 : une minute de moins').click();
  await page.getByLabel('Outil de l’étape 5').selectOption({ label: 'Accords' });
  await page.getByLabel('Monter l’étape 5').click();
  await page.locator('[data-step="2"]').getByRole('button', { name: 'Retirer cette étape' }).click(); // Technique
  await expect(page.locator('.redit-total b')).toHaveText('17 min');
  await button(page, 'Enregistrer').click();

  // Back on the routine: still on Gammes; Échauffement's time capped to its new 3 minutes.
  await expect(page).toHaveURL(/#\/pratiquer\/routine$/);
  expect(await texts(page, '.rlist-name')).toEqual(['Échauffement', 'Gammes', 'Accords', 'Impro funk']);
  await expect(page.locator('.rlist-time').first()).toHaveText('3:00 / 3:00');
  await expect(page.locator('.display').first()).toHaveText('ÉTAPE 2/4');
  await expect(page.locator('.kicker').first()).toHaveText('Routine du jour · 17 min');

  // The new step's tool and the home card follow.
  await page.locator('.rlist-row', { hasText: 'Accords' }).click();
  await expect(page.locator('.rring-sub')).toHaveText('sur 2:00');
  await expect(button(page, 'Ouvrir les accords ›')).toBeVisible();
  await page.goto('#/');
  await expect(page.locator('.resume-title')).toHaveText('Enchaîner Am, C et G sans regarder');
  await expect(page.locator('[data-tile="routine"] .pedal-sub')).toHaveText('3/17 min aujourd’hui');
  await page.goto('#/pratiquer');
  await expect(page.locator('.routine-total')).toHaveText('3/17 min');
  await expect(page.locator('.week-goal')).toHaveText('Objectif 17 min');

  // Kept after a reload.
  await page.reload();
  expect(await texts(page, '.rstep-name')).toEqual(['Échauffement', 'Gammes', 'Accords', 'Impro funk']);
});

test('a step needs a name; « Annuler » keeps the routine as it was; « Rétablir » brings the original back', async ({ page }) => {
  await page.goto('#/pratiquer/routine/modifier');
  await page.getByLabel('Nom de l’étape 2').fill('  ');
  await expect(page.locator('.redit-warn')).toHaveText('Chaque étape a besoin d’un nom.');
  await expect(button(page, 'Enregistrer')).toBeDisabled();
  await button(page, 'Annuler').click();
  await expect(page).toHaveURL(/#\/pratiquer\/routine$/); // opened directly: back to the routine
  await expect(page.locator('.rlist-name')).toHaveText(['Échauffement', 'Technique', 'Gammes', 'Impro']);

  // A shorter routine, then the original again.
  await button(page, 'Modifier').click();
  await page.locator('[data-step="4"]').getByRole('button', { name: 'Retirer cette étape' }).click();
  await button(page, 'Enregistrer').click();
  await expect(page.locator('.rlist-name')).toHaveCount(3);
  await button(page, 'Modifier').click();
  await button(page, 'Rétablir la routine d’origine…').click();
  await button(page, 'Rétablir').click();
  await button(page, 'Enregistrer').click();
  await expect(page.locator('.rlist-name')).toHaveText(['Échauffement', 'Technique', 'Gammes', 'Impro']);
  await button(page, 'Modifier').click();
  await expect(button(page, 'Rétablir la routine d’origine…')).toBeDisabled();
});

test('a custom routine runs to the end with its own lengths', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-20T10:00:00') });
  await page.goto('#/pratiquer/routine/modifier');
  for (const n of [4, 3]) await page.locator(`[data-step="${n}"]`).getByRole('button', { name: 'Retirer cette étape' }).click();
  for (let i = 0; i < 4; i++) await page.getByLabel('Étape 1 : une minute de moins').click();
  for (let i = 0; i < 7; i++) await page.getByLabel('Étape 2 : une minute de moins').click();
  await expect(page.locator('.redit-total b')).toHaveText('2 min');
  await button(page, 'Enregistrer').click();
  // Both steps were already done today in the example (capped to 1 min): the routine is finished.
  await expect(page.locator('.display').first()).toHaveText('TERMINÉE');
  await expect(page.locator('.rdetail p')).toHaveText('Les 2 étapes sont faites. À demain pour la suite de la série !');
  await button(page, 'REJOUER').click();
  await button(page, 'GO').click();
  await page.clock.runFor(61_000);
  await expect(page.locator('.rring-name')).toHaveText('Technique');
  await page.clock.runFor(61_000);
  await expect(page.locator('.display').first()).toHaveText('TERMINÉE');
});
