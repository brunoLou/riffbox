import { button, expect, test, texts } from './helpers';

test('the rhythm tool: models, arrows that light up while playing', async ({ page }) => {
  await page.goto('#/pratiquer');
  await page.locator('.prat-pedals [data-tile="rythme"]').click();
  await expect(page).toHaveURL(/#\/pratiquer\/rythme$/);
  await expect(page.locator('.rhythm-player .rhythm-name')).toHaveText('Pop / folk classique');
  await expect(page.locator('.rhythm-row.on .rhythm-arrows')).toHaveText('↓·↓↑·↑↓↑');
  await page.getByRole('button', { name: 'Jouer le rythme' }).click();
  await expect(page.locator('.rp-stroke.lit')).toHaveCount(1);
  await page.getByRole('button', { name: 'Arrêter' }).click();
  await page.locator('.rhythm-pick', { hasText: 'Ballade en 6/8' }).click();
  await expect(page.locator('.rhythm-player .rhythm-meta')).toContainText('6/8');
});

test('typing a rhythm from a score: notes, rest and tie become strokes, kept and editable', async ({ page }) => {
  await page.goto('#/pratiquer/rythme');
  await button(page, '✍︎ Recopier une partition').click();
  await page.getByLabel('Nom du rythme').fill('Mon couplet');
  await page.getByLabel(`Accord de la mesure 1`).fill('Am');
  // ♩ ♪ ♪ ⌒♪ ♪ ♪ ♪  →  the classic D DU UDU
  await button(page, 'Noire').click();
  await button(page, 'Croche').click();
  await button(page, 'Croche').click();
  await page.getByRole('button', { name: 'Liée à la précédente' }).click();
  await button(page, 'Croche').click();
  for (let i = 0; i < 3; i++) await button(page, 'Croche').click();
  // The bar is full: on to bar 2, which starts with a rest.
  await expect(page.locator('.saisie-bar .rhythm-name')).toHaveText('Mesure 2 / 2');
  await page.getByRole('button', { name: 'Mesure précédente' }).click();
  await expect(page.locator('.saisie-strokes')).toHaveText('↓·↓↑·↑↓↑');
  await page.getByRole('button', { name: 'Mesure suivante' }).click();
  await page.getByRole('button', { name: 'Silence', exact: true }).click();
  await button(page, 'Silence : Noire').click();
  await page.getByRole('button', { name: 'Silence', exact: true }).click();
  await button(page, 'Blanche pointée').click();
  // Full again: an empty third bar opens (it is not saved).
  await expect(page.locator('.saisie-bar .rhythm-name')).toHaveText('Mesure 3 / 3');
  await page.getByRole('button', { name: 'Mesure précédente' }).click();
  await expect(page.locator('.saisie-strokes')).toHaveText('··↓·····');
  await button(page, 'Enregistrer').click();

  await expect(page).toHaveURL(/#\/pratiquer\/rythme$/);
  await expect(page.locator('.rhythm-player .rhythm-name')).toHaveText('Mon couplet');
  expect(await texts(page, '.rp-bar')).toEqual(['Am↓·↓↑·↑↓↑', '··↓·····']);
  await page.reload();
  await page.getByRole('button', { name: 'Modifier Mon couplet' }).click();
  await expect(page.getByLabel('Nom du rythme')).toHaveValue('Mon couplet');
  await expect(page.locator('.saisie-strokes')).toHaveText('↓·↓↑·↑↓↑');
});

test('a Guitar Pro file: the whole song with its chords, or one of its patterns', async ({ page }) => {
  const at = await import('@coderline/alphatab/core');
  const s = new at.Settings();
  const EM = '(0.6 2.5 2.4 0.3 0.2 0.1)', C = '(3.5 2.4 0.3 1.2 0.1)';
  const bar = (c: string) => `${c}.4 ${c}.8 ${c}.8 r.8 ${c}.8 ${c}.8 ${c}.8`;
  const tex = `\\title "Chanson test" \\tempo 84 . \\track "Guitare rythmique" \\ts 4 4 ${bar(EM)} | ${bar(C)} | ${bar(EM)} | ${C}.1`;
  const imp = new at.importer.AlphaTexImporter();
  imp.initFromString(tex, s);
  const bytes = new at.exporter.Gp7Exporter().export(imp.readScore(), s);

  await page.goto('#/pratiquer/rythme');
  await page.getByLabel('Fichier Guitar Pro').setInputFiles({ name: 'chanson.gp', mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) });
  const dlg = page.getByRole('dialog', { name: 'Importer depuis Guitar Pro' });
  await expect(dlg.locator('.gp-info').first()).toHaveText('4 mesures · 84 BPM · Em C');
  await expect(dlg.locator('.gp-option', { hasText: 'Motif 1' })).toContainText('3 mesures');
  await dlg.locator('.gp-option', { hasText: 'Tout le morceau' }).click();
  await expect(page.locator('.rhythm-player .rhythm-name')).toHaveText('Chanson test · Guitare rythmique');
  expect(await texts(page, '.rp-bar')).toEqual(['Em↓·↓↑·↑↓↑', 'C↓·↓↑·↑↓↑', 'Em↓·↓↑·↑↓↑', 'C↓·······']);

  await page.getByLabel('Fichier Guitar Pro').setInputFiles({ name: 'pas-gp.gp', mimeType: 'application/octet-stream', buffer: Buffer.from('bonjour') });
  await expect(page.locator('.rythme-error')).toContainText('Guitar Pro');
});

test('a grid strums with the chosen pattern', async ({ page }) => {
  await page.goto('#/composer/grille/g-minuit');
  await page.getByLabel('Réglages de la grille').click();
  await page.getByLabel('Motif de grattage').selectOption({ label: 'Pop / folk classique · ↓·↓↑·↑↓↑' });
  await page.getByLabel('Fermer').click();
  await expect(page.locator('.grid-kicker')).toContainText('Grattage');
  await expect(page.locator('.strum-cell')).toHaveText(['↓', '·', '↓', '↑', '·', '↑', '↓', '↑']);
  await page.locator('.grid-loop').click();
  await expect(page.locator('.strum-cell.lit')).toHaveCount(1);
  await page.locator('.grid-loop').click();
  await page.reload();
  await expect(page.locator('.grid-kicker')).toContainText('Grattage');
});
