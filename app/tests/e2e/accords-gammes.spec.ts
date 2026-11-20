import { expect, test } from './helpers';

test('chord library: shapes, intervals, positions on the neck', async ({ page }) => {
  await page.goto('#/pratiquer/accords');
  await expect(page.locator('.chord-sym')).toHaveText('A');
  await expect(page.locator('.thumb')).toHaveCount(5);
  await expect(page.locator('.shape-label')).toHaveText('Forme de La (A) · position ouverte · 1/5');
  await expect(page.locator('.string-notes span')).toHaveText(['×', 'A', 'E', 'A', 'C♯', 'E']);
  await page.locator('.key-chip', { hasText: /^Do$/ }).click();
  await page.locator('.type-chip', { hasText: /^7$/ }).click();
  await expect(page.locator('.chord-fr')).toHaveText('Do septième');
  await page.getByLabel('Position suivante').click();
  await page.getByLabel('Position suivante').click();
  await expect(page.locator('.shape-label')).toHaveText('Forme de Sol (G) · case 5 · 3/5');
  await expect(page.locator('.diagram-main .cd-barre')).toHaveCount(1);
  await expect.poll(() => page.locator('.neck .dot').evaluateAll(ds => ds.filter(d => (d as HTMLElement).style.opacity === '1').length)).toBe(6);
  await page.locator('.mini-seg button', { hasText: 'Intervalles' }).click();
  await expect(page.locator('.string-notes span')).toHaveText(['1', '3', '5', '1', '3', '♭7']);
  await page.getByLabel(/^Écouter/).click();
  await page.locator('.type-chip', { hasText: /^m7♭5$/ }).click();
  await expect(page.locator('.thumb')).toHaveCount(3);
});

test('scale library: modes with CAGED positions, blues, arpeggios', async ({ page }) => {
  await page.goto('#/pratiquer/gammes');
  const chip = (n: string) => page.getByRole('button', { name: n, exact: true });
  await expect(page.locator('.scale-title')).toHaveText('La penta mineure· mêmes notes que Do penta majeure');
  await expect(page.locator('.box-btn')).toHaveText(['Tout', '1', '2', '3', '4', '5']);
  await chip('Dorien').click();
  await expect(page.locator('.scale-title')).toContainText('mêmes notes que Sol majeur');
  await expect(page.locator('.box-btn')).toHaveText(['Tout', 'A', 'G', 'E', 'D', 'C']);
  await page.locator('.mini-seg button', { hasText: 'Intervalles' }).click();
  await chip('Lydien').click();
  await expect(page.locator('.neck .dot', { hasText: '♯4' }).first()).toBeVisible();
  await chip('Blues').click();
  await expect(page.locator('.blue-btn')).toHaveCount(0);
  await expect(page.locator('.neck .dot.blue')).toHaveCount(8);
  await chip('Arp. m7').click();
  await expect(page.locator('.scale-title')).toContainText('Am7');
  await chip('Penta min').click();
  await page.locator('.blue-btn').click();
  await expect(page.locator('.neck .dot.blue').first()).toBeVisible();
  await page.getByLabel('Écouter la gamme').click();
  await page.locator('.lib-tabs a', { hasText: 'Accords' }).click();
  await expect(page).toHaveURL(/#\/pratiquer\/accords$/);
});
