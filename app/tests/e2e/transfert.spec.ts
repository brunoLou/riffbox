import { button, expect, test } from './helpers';

const card = (page: import('@playwright/test').Page, title: string) =>
  page.locator('.idea', { has: page.locator('.idea-title', { hasText: title }) });

test('phone ⇄ tablet: the newest version of each item wins, deletions travel, nothing is lost', async ({ page: phone, browser }) => {
  // ---- On the phone: lyrics changed, a new note, an example deleted.
  await phone.goto('#/scene/morceau/s3');
  await phone.locator('.chordpro').fill('{c:Couplet}\n[A7]Version du téléphone');
  await phone.goto('#/composer');
  await button(phone, '+ Texte').click();
  const note = phone.getByRole('dialog', { name: 'Nommer l’idée' });
  await note.locator('input.text-input').fill('Note du téléphone');
  await note.locator('textarea').fill('Un pont en Fa♯m');
  await note.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await card(phone, 'Funk en Mi m').locator('.idea-open').click();
  phone.once('dialog', d => d.accept());
  await card(phone, 'Funk en Mi m').getByRole('button', { name: 'Supprimer' }).click();
  await expect(card(phone, 'Funk en Mi m')).toHaveCount(0);

  await phone.goto('#/reglages');
  const [sent] = await Promise.all([phone.waitForEvent('download'), button(phone, 'Envoyer').click()]);
  expect(sent.suggestedFilename()).toMatch(/^riffbox-envoi-\d{4}-\d{2}-\d{2}-\d{2}h\d{2}\.json$/);
  const fromPhone = (await sent.path())!;
  await expect(phone.locator('.transfer-dates')).toContainText('Dernier envoi');

  // ---- On the tablet: its own setlist, then it receives the phone's file.
  const ctx = await browser.newContext({ viewport: { width: 520, height: 960 }, reducedMotion: 'reduce', serviceWorkers: 'block', acceptDownloads: true });
  const tablet = await ctx.newPage();
  await tablet.goto('/#/scene');
  await tablet.getByText('+ Nouvelle setlist').click();
  await tablet.locator('.set-title-input').fill('Set tablette');
  await button(tablet, 'Terminé').click();

  await tablet.goto('/#/reglages');
  await tablet.locator('input[aria-label="Fichier reçu de l’autre appareil"]').setInputFiles(fromPhone);
  const preview = tablet.locator('.transfer-preview');
  await expect(preview.locator('.data-list > div')).toHaveText(['Idées+1 nouveau · −1 supprimé', 'Morceaux1 mis à jour']);
  await Promise.all([tablet.waitForEvent('load'), button(tablet, 'Mettre à jour cet appareil').click()]);
  await tablet.goto('/#/scene/bar-du-port/play/2');
  await expect(tablet.locator('.lyric-text').first()).toHaveText('Version du téléphone');
  await tablet.goto('/#/composer');
  await expect(card(tablet, 'Note du téléphone')).toHaveCount(1);
  await expect(card(tablet, 'Funk en Mi m')).toHaveCount(0);
  await tablet.goto('/#/scene');
  await expect(tablet.locator('.set-name', { hasText: 'Set tablette' })).toHaveCount(1);

  // ---- Back to the phone: the tablet's setlist arrives, the deleted example does not come back.
  await tablet.goto('/#/reglages');
  const [back] = await Promise.all([tablet.waitForEvent('download'), button(tablet, 'Envoyer').click()]);
  const fromTablet = (await back.path())!;
  await phone.goto('#/reglages');
  await phone.locator('input[aria-label="Fichier reçu de l’autre appareil"]').setInputFiles(fromTablet);
  await expect(phone.locator('.transfer-preview .data-list > div')).toHaveText(['Setlists+1 nouveau']);
  await Promise.all([phone.waitForEvent('load'), button(phone, 'Mettre à jour cet appareil').click()]);
  await phone.goto('#/scene');
  await expect(phone.locator('.set-name', { hasText: 'Set tablette' })).toHaveCount(1);
  await phone.goto('#/composer');
  await expect(card(phone, 'Funk en Mi m')).toHaveCount(0);

  // ---- The same file again: nothing to do.
  await phone.goto('#/reglages');
  await phone.locator('input[aria-label="Fichier reçu de l’autre appareil"]').setInputFiles(fromTablet);
  await expect(phone.locator('.transfer-preview')).toContainText('Cet appareil est déjà à jour');
  await expect(button(phone, 'Mettre à jour cet appareil')).toHaveCount(0);
  await ctx.close();
});
