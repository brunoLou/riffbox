import { button, expect, test } from './helpers';

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
  await page.locator('.label-seg button', { hasText: 'Intervalles' }).click();
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
  await expect(page.locator('.blue-btn:not(.treble-btn)')).toHaveCount(0);
  await expect(page.locator('.neck .dot.blue')).toHaveCount(8);
  await chip('Arp. m7').click();
  await expect(page.locator('.scale-title')).toContainText('Am7');
  await chip('Penta min').click();
  await page.locator('.blue-btn:not(.treble-btn)').click();
  await expect(page.locator('.neck .dot.blue').first()).toBeVisible();
  await page.getByLabel('Écouter la gamme').click();
  await page.locator('.lib-tabs a', { hasText: 'Accords' }).click();
  await expect(page).toHaveURL(/#\/pratiquer\/accords$/);
});

test('fingers on the diagram, and the inversions of a chord on each string group', async ({ page }) => {
  await page.goto('#/pratiquer/accords');
  await page.locator('.key-chip', { hasText: /^Fa$/ }).click();
  await page.getByRole('group', { name: 'Sur le diagramme' }).getByRole('button', { name: 'Doigts' }).click();
  // F barre chord, E shape: index across, 3 and 4 on A and D, 2 on G.
  await expect(page.locator('.shape-label')).toHaveText(/^Forme de Mi \(E\) · case 1/);
  await expect(page.locator('.string-notes span')).toHaveText(['1', '3', '4', '2', '1', '1']);
  await expect(page.locator('.diagram-main .cd-label')).toHaveText(['1', '3', '4', '2', '1', '1']);
  await expect(page.locator('.diagram-main .cd-barre')).toHaveCount(1);

  // Open A: three fingers, no barre.
  await page.locator('.key-chip', { hasText: /^La$/ }).click();
  await expect(page.locator('.string-notes span')).toHaveText(['×', '○', '1', '2', '3', '○']);
  await expect(page.locator('.diagram-main .cd-barre')).toHaveCount(0);

  // Inversions of C on the top three strings.
  await page.locator('.key-chip', { hasText: /^Do$/ }).click();
  await page.getByRole('group', { name: 'Sur le diagramme' }).getByRole('button', { name: 'Notes' }).click();
  await button(page, 'Renversements').click();
  await expect(page.getByRole('group', { name: 'Cordes' }).getByRole('button')).toHaveText(['Sol · Si · Mi', 'Ré · Sol · Si', 'La · Ré · Sol', 'Mi · La · Ré']);
  await expect(page.locator('.thumb-label b')).toHaveText(['C', 'C/E', 'C/G']);
  await page.getByLabel('Position suivante').click();
  await expect(page.locator('.shape-label')).toHaveText('1er renversement · C/E · 3 à la basse · case 8 · 2/3');
  await expect(page.locator('.string-notes span')).toHaveText(['×', '×', '×', 'E', 'G', 'C']);

  // Four-note chords use four strings; the choice of strings is kept.
  await page.getByRole('group', { name: 'Cordes' }).getByRole('button', { name: 'Ré · Sol · Si' }).click();
  await expect(page.locator('.string-notes span').first()).toHaveText('×');
  await page.locator('.type-chip', { hasText: /^maj7$/ }).click();
  await expect(page.getByRole('group', { name: 'Cordes' }).getByRole('button')).toHaveText(['Ré · Sol · Si · Mi', 'La · Ré · Sol · Si', 'Mi · La · Ré · Sol']);
  await expect(page.locator('.thumb-label b')).toHaveText(['Cmaj7', 'Cmaj7/E', 'Cmaj7/G', 'Cmaj7/B']);

  // Power chords have no inversions.
  await page.locator('.type-chip', { hasText: /^5$/ }).click();
  await expect(button(page, 'Renversements')).toBeDisabled();
  await expect(page.locator('.inv-help')).toBeVisible();
  await expect(page.locator('.shape-label')).toHaveText(/^Forme de/);
});

test('scales: « 3 cordes aiguës » dims the low strings, and pentatonics get sliding forms', async ({ page }) => {
  await page.goto('#/pratiquer/gammes');
  await page.getByRole('button', { name: 'Penta min', exact: true }).click();
  await page.getByRole('button', { name: 'La', exact: true }).click();
  const toggle = page.getByRole('button', { name: '3 cordes aiguës' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-string="0"] .dot.lit').first()).toBeVisible(); // position 1 uses the low E
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  // Only the G, B and high e strings stay lit.
  for (const si of [0, 1, 2]) await expect(page.locator(`[data-string="${si}"] .dot.lit`)).toHaveCount(0);
  await expect(page.locator('[data-string="5"] .dot.lit').first()).toBeVisible();

  // Sliding forms: two notes per string, climbing.
  const forms = page.getByRole('group', { name: 'Formes glissées' }).getByRole('button');
  await expect(forms).toHaveText(['↗1', '↗2', '↗3', '↗4', '↗5']);
  await forms.nth(1).click();
  await expect(forms.nth(1)).toHaveAttribute('aria-pressed', 'true');
  for (const [si, notes] of [[3, ['A', 'C']], [4, ['D', 'E']], [5, ['G', 'A']]] as const) {
    await expect(page.locator(`[data-string="${si}"] .dot.lit`)).toHaveText([...notes]);
  }
  // Remembered.
  await page.reload();
  await expect(page.getByRole('button', { name: '3 cordes aiguës' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.dot.lit')).toHaveCount(6);

  // Other scales: the option stays, without sliding forms.
  await page.getByRole('button', { name: 'Dorien', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Formes glissées' })).toHaveCount(0);
  for (const si of [0, 1, 2]) await expect(page.locator(`[data-string="${si}"] .dot.lit`)).toHaveCount(0);
  await expect(page.locator('[data-string="4"] .dot.lit').first()).toBeVisible();
});
