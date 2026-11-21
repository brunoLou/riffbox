import { button, expect, fakeMic, guitarString, test, texts } from './helpers';

test.use(fakeMic(guitarString('carnet-mic', 196)));

const card = (page: import('@playwright/test').Page, title: string) =>
  page.locator('.idea', { has: page.locator('.idea-title', { hasText: new RegExp('^' + title + '$') }) });

test('filters by type, style and key', async ({ page }) => {
  await page.goto('#/composer');
  await expect(page.locator('.idea')).toHaveCount(8);
  await page.locator('.kind-chip', { hasText: 'Riffs' }).click();
  await expect(page.locator('.idea')).toHaveCount(3);
  await page.locator('.fsel select').nth(1).selectOption('Funk');
  await expect(page.locator('.idea-title')).toHaveText(['Funk en Mi m, 16e']);
  await page.locator('.fsel select').nth(1).selectOption('');
  await page.locator('.kind-chip', { hasText: 'Tout' }).click();
  await page.locator('.fsel select').nth(0).selectOption('La');
  expect(await texts(page, '.idea-title')).toEqual(expect.arrayContaining(['Riff shuffle en La', 'Minuit Shuffle']));
});

test('plays an example and opens a grid', async ({ page }) => {
  await page.goto('#/composer');
  await card(page, 'Riff shuffle en La').locator('.idea-play').click();
  await expect(card(page, 'Riff shuffle en La').locator('.wave span.played').first()).toBeVisible();
  await card(page, 'Minuit Shuffle').locator('.idea-top').click();
  await page.getByText('Ouvrir la grille ›').click();
  await expect(page).toHaveURL(/#\/composer\/grille\/g-minuit$/);
});

test('records from “+ Idée”, keeps the recording after a reload, and deletes it', async ({ page }) => {
  await page.goto('#/');
  await page.locator('.fab').click();
  await expect(page).toHaveURL(/#\/composer$/);
  await expect(page.locator('.rec-time')).toHaveText(/0:0[1-9]/, { timeout: 5000 });
  await page.getByText('■ Arrêter et ranger').click();
  const title = page.locator('.idea-title').first();
  await expect(title).toHaveText(/^Mémo du /);
  await expect(page.locator('.idea-meta').first()).toHaveText(/Mémo vocal · aujourd’hui · 0:0\d/);

  await page.reload();
  await page.locator('.kind-chip', { hasText: 'Tout' }).click();
  await page.locator('.idea-play').first().click();
  await expect(page.locator('.idea-play.on')).toHaveCount(1);

  await page.locator('.idea-top').first().click();
  page.once('dialog', d => d.accept());
  await button(page, 'Supprimer').click();
  await expect(page.locator('.idea-title').first()).not.toHaveText(/^Mémo du /);
  await page.goto('#/');
  await expect(page.locator('[data-tile="carnet"] .pedal-sub')).toHaveText('8 idées');
});

test('cancelling a recording keeps nothing', async ({ page }) => {
  await page.goto('#/composer');
  await page.locator('.rec-cta').click();
  await expect(page.locator('.rec-sheet')).toBeVisible();
  await button(page, 'Annuler').click();
  await expect(page.locator('.idea')).toHaveCount(8);
});

test('a new recording is named and tagged right away, and keeps its tags', async ({ page }) => {
  await page.clock.install();
  await page.goto('#/composer');
  await page.locator('.rec-cta').click();
  await page.clock.runFor(1500);
  await expect(page.locator('.rec-time')).toHaveText(/0:0[1-9]/);
  await page.getByText('■ Arrêter et ranger').click();

  const sheet = page.getByRole('dialog', { name: 'Nommer l’idée' });
  await expect(sheet.locator('.text-input')).toHaveValue(/^Mémo du /);
  await page.keyboard.type('Solo en Sol'); // the dated title is selected: typing replaces it
  await sheet.getByRole('button', { name: 'Riff', exact: true }).click();
  await sheet.getByLabel('Tonalité').selectOption({ label: 'Sol' });
  await expect(sheet.getByRole('button', { name: 'Majeur' })).toHaveAttribute('aria-pressed', 'true');
  await page.clock.pauseAt(Date.now() + 10_000);
  for (let i = 0; i < 4; i++) { await sheet.getByRole('button', { name: 'Tap' }).click(); await page.clock.runFor(500); }
  await expect(sheet.locator('.idea-bpm')).toHaveText('120 BPM');
  await sheet.getByRole('button', { name: 'Blues' }).click();
  await sheet.getByRole('button', { name: 'Groovy' }).click();
  await sheet.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(sheet).toHaveCount(0);

  const c = card(page, 'Solo en Sol');
  await expect(c.locator('.idea-meta')).toHaveText(/^Riff · aujourd’hui/);
  await expect(c.locator('.tag')).toHaveText(['Sol', '120 BPM', 'Blues', 'Groovy']);
  await page.reload();
  await expect(card(page, 'Solo en Sol').locator('.tag')).toHaveText(['Sol', '120 BPM', 'Blues', 'Groovy']);
  await page.locator('.fsel select').nth(3).selectOption('Rapide');
  await expect(card(page, 'Solo en Sol')).toHaveCount(1);
});

test('« Plus tard » keeps the recording with its dated name', async ({ page }) => {
  await page.goto('#/composer');
  await page.locator('.rec-cta').click();
  await expect(page.locator('.rec-time')).toHaveText(/0:0[1-9]/, { timeout: 5000 });
  await page.getByText('■ Arrêter et ranger').click();
  await page.getByRole('button', { name: 'Plus tard' }).click();
  await expect(page.locator('.idea-title').first()).toHaveText(/^Mémo du /);
  await expect(page.locator('.idea')).toHaveCount(9);
});

test('edit an example: rename, change the mood, remove the style', async ({ page }) => {
  await page.goto('#/composer');
  await card(page, 'Idée de pont, fredonnée').locator('.idea-top').click();
  await button(page, 'Modifier').click();
  const sheet = page.getByRole('dialog', { name: 'Modifier l’idée' });
  await expect(sheet.getByRole('button', { name: 'Mineur' })).toHaveAttribute('aria-pressed', 'true');
  await sheet.locator('.text-input').fill('Pont du refrain');
  await sheet.getByRole('button', { name: 'Rock' }).click(); // touching the chosen style removes it
  await sheet.getByRole('button', { name: 'Mélancolique' }).click();
  await sheet.getByRole('button', { name: 'Effacer le tempo' }).click();
  await sheet.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(card(page, 'Pont du refrain').locator('.tag')).toHaveText(['Mi m', 'Mélancolique']);
  // Without a name, nothing can be saved.
  await card(page, 'Pont du refrain').locator('.idea-top').click();
  await card(page, 'Pont du refrain').locator('.idea-top').click();
  await button(page, 'Modifier').click();
  await sheet.locator('.text-input').fill('  ');
  await expect(sheet.getByRole('button', { name: 'Enregistrer', exact: true })).toBeDisabled();
});

test('write a text idea; « Plus tard » on a new text keeps nothing', async ({ page }) => {
  await page.goto('#/composer');
  await button(page, '+ Texte').click();
  await page.getByRole('button', { name: 'Plus tard' }).click();
  await expect(page.locator('.idea')).toHaveCount(8);

  await button(page, '+ Texte').click();
  const sheet = page.getByRole('dialog', { name: 'Nommer l’idée' });
  await expect(sheet.getByRole('group', { name: 'Type' })).toHaveCount(0);
  await sheet.locator('input.text-input').fill('Couplet 2');
  await sheet.locator('textarea').fill('Le quai s’endort\nLa ville aussi');
  await sheet.getByRole('button', { name: 'Nostalgique' }).click();
  await sheet.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  const c = card(page, 'Couplet 2');
  await expect(c.locator('.idea-meta')).toHaveText(/^Paroles · aujourd’hui/);
  await expect(c.locator('.idea-text')).toContainText('La ville aussi');
  await page.locator('.kind-chip', { hasText: 'Paroles' }).click();
  await expect(page.locator('.idea-title')).toHaveText(['Couplet 2', 'Néons du quai']);
});

test('tempo filter, and a way out when nothing matches', async ({ page }) => {
  await page.goto('#/composer');
  const tempo = page.locator('.fsel select').nth(3);
  await tempo.selectOption('Lent');
  expect(await texts(page, '.idea-title')).toContain('Idée de pont, fredonnée');
  for (const t of await texts(page, '.idea-meta')) expect(t).not.toContain('Paroles'); // no tempo, not shown
  await tempo.selectOption('Rapide');
  expect(await texts(page, '.idea-title')).toContain('Intro rock en Ré');
  expect(await texts(page, '.idea-title')).not.toContain('Idée de pont, fredonnée');
  await page.locator('.fsel select').nth(2).selectOption('Sombre');
  await expect(page.locator('.carnet-empty')).toContainText('Aucune idée ne correspond');
  await button(page, 'Effacer les filtres').click();
  await expect(page.locator('.idea')).toHaveCount(8);
});
