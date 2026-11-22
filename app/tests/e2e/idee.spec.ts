import { button, expect, fakeMic, guitarString, test } from './helpers';

test.use(fakeMic(guitarString('idee-mic', 220)));

const idea = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Nouvelle idée' });

test('« + Idée » is on every screen with tabs, not on the stage', async ({ page }) => {
  for (const r of ['/', '/accordeur', '/metronome', '/composer', '/composer/grille/g-minuit', '/pratiquer', '/pratiquer/routine', '/pratiquer/backing', '/scene', '/scene/morceaux', '/voix', '/reglages']) {
    await page.goto('#' + r);
    await expect(idea(page), r).toBeVisible();
  }
  await page.goto('#/scene/bar-du-port/play/2');
  await expect(page.locator('.stage-title')).toBeVisible();
  await expect(idea(page)).toHaveCount(0);
});

test('record over the metronome without leaving it: the idea takes its tempo, then goes to the notebook', async ({ page }) => {
  await page.goto('#/metronome');
  await page.locator('.cta').click(); // the metronome plays
  await idea(page).click();
  const sheet = page.getByRole('dialog', { name: 'Capture rapide' });
  await expect(sheet.locator('.rec-time')).toHaveText(/0:0[1-9]/, { timeout: 5000 });
  await sheet.getByText('■ Arrêter et ranger').click();

  const name = page.getByRole('dialog', { name: 'Nommer l’idée' });
  await expect(name.locator('.idea-bpm')).toHaveText('92 BPM');
  await page.keyboard.type('Riff du métronome');
  await name.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  // The confirmation shows for 8 s: check it first.
  await expect(page.locator('.qc-toast')).toContainText('Rangé dans le Carnet : Riff du métronome');
  await expect(page).toHaveURL(/#\/metronome$/);
  await expect(page.locator('.cta')).toHaveText('Arrêter'); // still playing

  await page.locator('.qc-toast').getByRole('link', { name: 'Voir ›' }).click();
  await expect(page).toHaveURL(/#\/composer$/);
  const card = page.locator('.idea', { has: page.locator('.idea-title', { hasText: 'Riff du métronome' }) });
  await expect(card.locator('.tag')).toHaveText(['92 BPM']);
  await page.reload();
  await card.locator('.idea-play').click();
  await expect(card.locator('.idea-play.on')).toHaveCount(1);
});

test('a written note from a grid takes its key, tempo and style', async ({ page }) => {
  await page.goto('#/composer/grille/g-minuit');
  await idea(page).click();
  await page.getByRole('button', { name: 'Écrire plutôt ›' }).click();
  const note = page.getByRole('dialog', { name: 'Note rapide' });
  await expect(button(page, 'Ranger dans le Carnet')).toBeDisabled();
  await note.getByLabel('Texte').fill('Pont : monter d’un ton au deuxième passage');
  await button(page, 'Ranger dans le Carnet').click();
  await page.getByRole('button', { name: 'Plus tard' }).click();
  await expect(page).toHaveURL(/grille\/g-minuit$/);
  await expect(page.locator('.qc-toast')).toContainText('Rangé dans le Carnet : Pont : monter d’un ton'); // first line, shortened

  await page.goto('#/composer');
  const card = page.locator('.idea', { has: page.locator('.idea-title', { hasText: 'Pont : monter' }) });
  await expect(card.locator('.idea-meta')).toHaveText(/^Paroles · aujourd’hui/);
  await expect(card.locator('.tag')).toHaveText(['La', '92 BPM', 'Blues']);
});

test('cancelling keeps nothing; an idea captured on the notebook screen appears right away', async ({ page }) => {
  await page.goto('#/composer');
  await expect(page.locator('.idea')).toHaveCount(8);
  await idea(page).click();
  await page.getByRole('dialog', { name: 'Capture rapide' }).getByRole('button', { name: 'Annuler' }).click();
  await expect(page.locator('.idea')).toHaveCount(8);

  await idea(page).click();
  await expect(page.locator('.rec-time')).toHaveText(/0:0[1-9]/, { timeout: 5000 });
  await page.getByText('■ Arrêter et ranger').click();
  await page.getByRole('button', { name: 'Plus tard' }).click();
  await expect(page.locator('.idea')).toHaveCount(9);
  await expect(page.locator('.idea-title').first()).toHaveText(/^Mémo du /);
});
