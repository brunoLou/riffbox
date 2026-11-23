import { AxeBuilder } from '@axe-core/playwright';
import { button, expect, fakeMic, guitarString, test } from './helpers';

test.use(fakeMic(guitarString('a11y-mic', 196)));

const ROUTES = [
  '/', '/accordeur', '/metronome', '/composer', '/composer/grilles', '/composer/grille/g-minuit', '/pratiquer', '/pratiquer/routine',
  '/pratiquer/routine/modifier', '/pratiquer/gammes', '/pratiquer/accords', '/pratiquer/backing', '/voix', '/voix/exercices',
  '/voix/melodies', '/voix/prises', '/voix/tessiture', '/voix/tonalite', '/voix/ex/gamme5', '/outils/capo', '/outils/ton', '/pratiquer/looper', '/scene',
  '/scene/bar-du-port', '/scene/morceaux', '/scene/morceau/s3', '/scene/bar-du-port/play/2', '/reglages', '/reglages/design',
];
/** WCAG 2.2 A and AA, plus axe's best practices (landmarks, one h1…). */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

const audit = async (page: import('@playwright/test').Page, where: string) => {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = violations.map(v => `${v.id} (${v.impact}) : ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`);
  expect(summary, where).toEqual([]);
};

for (const theme of ['dark', 'light'] as const) {
  test(`every screen passes axe in the ${theme} theme`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('#/');
    await page.evaluate(t => localStorage.setItem('riffbox:v1:settings.theme', JSON.stringify(t)), theme);
    for (const r of ROUTES) {
      await page.goto('#' + r);
      await page.reload();
      await expect(page.locator('h1')).toHaveCount(1);
      await page.waitForTimeout(250); // let live readouts settle
      await audit(page, `${theme} ${r}`);
    }
  });
}

test('the sheets pass axe once open', async ({ page }) => {
  await page.goto('#/composer');
  await page.locator('.idea-open').first().click();
  await button(page, 'Modifier').click();
  await audit(page, 'éditeur d’idée');

  await page.goto('#/composer/grille/g-minuit');
  await page.getByLabel('Accord D : diagramme').click();
  await audit(page, 'feuille d’accord');

  await page.goto('#/accordeur');
  await button(page, '+ Perso').click();
  await audit(page, 'éditeur d’accordage');

  await page.goto('#/');
  await button(page, 'Modifier').click();
  await page.getByText('+ Ajouter une pédale').click();
  await audit(page, 'catalogue des pédales');

  await page.goto('#/metronome');
  await page.getByRole('button', { name: 'Nouvelle idée' }).click();
  await page.getByRole('button', { name: 'Écrire plutôt ›' }).click();
  await audit(page, 'note rapide');

  await page.goto('#/composer');
  await page.getByText('+ Grille').click();
  await audit(page, 'nouvelle grille');

  await page.goto('#/scene/morceaux');
  await page.getByRole('button', { name: 'Coller…' }).click();
  await audit(page, 'coller un morceau');

  await page.goto('#/pratiquer/backing');
  await page.getByRole('button', { name: 'Lire Blues en La' }).click();
  await page.keyboard.press(' ');
  await audit(page, 'lecteur de backing track');

  await page.goto('#/scene/morceau/s3');
  await page.locator('.mini-seg button', { hasText: 'Rimes' }).click();
  await audit(page, 'onglet rimes');
  await page.locator('.lyr-line').first().click();
  await expect(page.locator('.rhyme-word').first()).toBeVisible();
  await audit(page, 'feuille de rimes');
  await page.keyboard.press('Escape');
  await page.locator('.mini-seg button', { hasText: 'Temps' }).click();
  await audit(page, 'onglet temps forts');
});

test('sheets with the keyboard: focus goes in, Tab stays in, Escape closes and gives focus back; the pedal waits', async ({ page }) => {
  await page.goto('#/composer/grille/g-minuit');
  const slot = page.getByLabel('Accord D : diagramme');
  await slot.focus();
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'Accord D' });
  await expect(sheet).toHaveAttribute('aria-modal', 'true');
  await expect.poll(() => sheet.evaluate(el => el.contains(document.activeElement))).toBe(true);
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await sheet.evaluate(el => el.contains(document.activeElement)), `Tab ${i + 1}`).toBe(true);
  }
  // The pedal (→) does not start the loop behind the sheet.
  await page.keyboard.press('PageDown');
  await expect(page.locator('.grid-loop')).toHaveText(/Boucle/);
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(slot).toBeFocused();
});

test('keyboard focus is visible', async ({ page }) => {
  await page.goto('#/metronome');
  await expect(page.locator('h1')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect.poll(() => page.evaluate(() => document.activeElement !== document.body && getComputedStyle(document.activeElement!).outlineStyle)).toBe('solid');
});
