import { readFileSync } from 'node:fs';
import { button, expect, test } from './helpers';

test('songbook PDFs: a setlist with its running order, and the whole library', async ({ page }) => {
  await page.goto('#/scene/bar-du-port');
  const [set] = await Promise.all([page.waitForEvent('download'), button(page, 'PDF du set (pour le groupe ou à imprimer)').click()]);
  expect(set.suggestedFilename()).toBe('bar-du-port.pdf');
  const a = readFileSync((await set.path())!).toString('latin1');
  expect(a.startsWith('%PDF-1.4')).toBe(true);
  for (const t of ['(Bar du Port)', '(Minuit Shuffle)', '(Dernier verre)']) expect(a).toContain(t);
  expect(a).toContain('%%EOF');

  await page.goto('#/scene/morceaux');
  const [lib] = await Promise.all([page.waitForEvent('download'), button(page, 'Recueil PDF').click()]);
  expect(lib.suggestedFilename()).toBe('recueil-riffbox.pdf');
  const b = readFileSync((await lib.path())!).toString('latin1');
  expect(b).toContain('(Minuit Shuffle)');
  await expect(page.locator('.cp-msg')).toContainText('Recueil PDF de 11 morceaux prêt.');
});
