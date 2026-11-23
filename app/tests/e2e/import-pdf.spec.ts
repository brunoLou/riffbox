import { button, expect, test } from './helpers';

/** A line of a sheet as people print it: each chord sits right above the syllable it falls on. */
const line = (segs: [string, string][]) =>
  `<div class="l">${segs.map(([c, t]) => `<span class="s">${c ? `<b>${c}</b>` : ''}${t}</span>`).join('')}</div>`;

const SONGBOOK = `<!doctype html><meta charset="utf-8"><style>
  body { font: 15px Arial, sans-serif; margin: 40px; }
  h1 { font-size: 26px; margin: 30px 0 4px; } .sub { margin: 0 0 14px; }
  .l { position: relative; margin-top: 18px; white-space: pre; }
  .s { position: relative; } .s b { position: absolute; left: 0; top: -1.15em; font-weight: bold; }
  h2 { font-size: 15px; margin: 20px 0 0; } .chords { white-space: pre; margin-top: 8px; }
</style>
<h1>Le Fleuve</h1><p class="sub">Capo 2</p>
<h2>Couplet 1</h2>
${line([['G', 'Le fleuve '], ['D', 'dort sous la '], ['Em', 'chaleur']])}
${line([['C', 'Et moi je '], ['G', 'compte les '], ['D', 'heures']])}
<h2>Refrain</h2>
${line([['C', 'Rien ne '], ['G', 'presse']])}
<h1 style="page-break-before: always">Café du port</h1>
${line([['Lam', 'Le café '], ['Fa', 'fume encore']])}
<p class="chords">Do   Sol   Lam   (x2)</p>`;

test('a PDF songbook: each song found, chords placed above their syllables, previewed then added', async ({ page, browser }) => {
  // A real PDF, printed by Chromium from the page above (proportional font, two pages).
  const maker = await browser.newPage();
  await maker.setContent(SONGBOOK);
  const pdf = await maker.pdf({ format: 'A4' });
  await maker.close();

  await page.goto('#/scene/morceaux');
  const before = await page.locator('.lib-row').count();
  await page.locator('input[type=file]').setInputFiles({ name: 'recueil.pdf', mimeType: 'application/pdf', buffer: pdf });
  const sheet = page.getByRole('dialog', { name: 'Importer des morceaux' });
  await expect(sheet.locator('.sheet-kicker')).toHaveText('2 morceaux trouvés', { timeout: 15_000 });
  await expect(sheet.locator('.cp-pick .song-title')).toHaveText(['Le Fleuve', 'Café du port']);
  await expect(sheet.locator('.cp-pick').nth(0).locator('.song-meta')).toContainText('Sol · ');
  await expect(sheet.locator('.cp-pick').nth(1).locator('.song-meta')).toContainText('La m · ');

  // The preview shows the chords where they will be on stage.
  await button(page, 'Aperçu de « Le Fleuve »').click();
  await expect(sheet.locator('.cp-preview .lyric-section').first()).toHaveText('Couplet 1');
  await button(page, 'Importer 2 morceaux').click();
  await expect(page.locator('.lib-row')).toHaveCount(before + 2);

  await page.locator('.lib-row', { hasText: 'Le Fleuve' }).click();
  await expect(page.locator('textarea')).toHaveValue(
    '{c:Couplet 1}\n[G]Le fleuve [D]dort sous la [Em]chaleur\n[C]Et moi je [G]compte les [D]heures\n\n{c:Refrain}\n[C]Rien ne [G]presse');
  await expect(page.locator('.mini-stepper .mono').nth(1)).toHaveText('2'); // capo
  await page.goto('#/scene/morceaux');
  await page.locator('.lib-row', { hasText: 'Café du port' }).click();
  await expect(page.locator('textarea')).toHaveValue('[Am]Le café [F]fume encore\n[C] [G] [Am] (x2)');
});

test('pasted text: chords over lyrics become a song; text without chords is refused', async ({ page }) => {
  await page.goto('#/scene/morceaux');
  await button(page, 'Coller…').click();
  const box = page.getByLabel('Texte du morceau');
  await box.fill('Rien ne presse\n\nRefrain :\nC       G\nRien ne presse\nTempo: 84');
  await button(page, 'Convertir').click();
  const sheet = page.getByRole('dialog', { name: 'Importer des morceaux' });
  await expect(sheet.locator('.cp-pick .song-title')).toHaveText(['Rien ne presse']);
  await expect(sheet.locator('.cp-pick .song-meta')).toContainText('Do · 84 BPM');
  await button(page, 'Importer 1 morceau').click();
  await page.locator('.lib-row', { hasText: 'Rien ne presse' }).click();
  await expect(page.locator('textarea')).toHaveValue('{c:Refrain}\n[C]Rien ne [G]presse');

  await page.goto('#/scene/morceaux');
  await button(page, 'Coller…').click();
  await page.getByLabel('Texte du morceau').fill('Une liste de courses\nPain\nLait');
  await button(page, 'Convertir').click();
  await expect(page.locator('.cp-msg.error')).toContainText('pas d’accords reconnus');
});
