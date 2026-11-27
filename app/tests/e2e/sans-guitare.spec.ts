import { button, expect, test } from './helpers';

test('a theory session: questions with explanations, scores, and the time counts as practice', async ({ page }) => {
  await page.clock.install();
  await page.goto('#/pratiquer');
  await page.locator('.off-card').click();
  await expect(page).toHaveURL(/#\/pratiquer\/sans-guitare$/);
  await expect(page.locator('.off-today-min')).toHaveText('0/10 min');
  await page.locator('.off-step', { hasText: 'Théorie et accords' }).click();
  await expect(page).toHaveURL(/#\/pratiquer\/theorie$/);

  await button(page, 'Commencer').click();
  for (let i = 0; i < 3; i++) {
    await page.clock.fastForward(40_000); // thinking about the answer
    await page.locator('.ear-choice').first().click();
    await expect(page.locator('.theory-explain')).toBeVisible();
    await expect(page.locator('.ear-choice.right')).toHaveCount(1);
    await button(page, 'Suivant ›').click();
  }
  await expect(page.locator('.sets-count')).toHaveText(/^[0-3]\/3$/);
  await expect(page.locator('.ear-stats')).toContainText('sur 3 questions');

  await page.goto('#/pratiquer/sans-guitare');
  // 3 × 40 s of answering: 2 minutes counted.
  await expect(page.locator('.off-today-min')).toHaveText('2/10 min');
  await expect(page.locator('.off-step', { hasText: 'Théorie et accords' }).locator('.off-step-time')).toHaveText('2/4 min');
  await page.goto('#/pratiquer/progres');
  await expect(page.getByRole('region', { name: 'Théorie' })).toContainText('sur 3 questions');
});

test('one kind of question at a time; a diagram to name', async ({ page }) => {
  await page.goto('#/pratiquer/theorie');
  await page.getByLabel('Type de questions').selectOption({ label: 'Diagrammes d’accords' });
  await button(page, 'Commencer').click();
  await expect(page.locator('.theory-prompt')).toHaveText('Quel est cet accord ?');
  await expect(page.locator('.ear-shape svg')).toBeVisible();
  await expect(page.locator('.ear-choice')).toHaveCount(4);
  await button(page, 'Avancé').click();
  await page.getByLabel('Type de questions').selectOption({ label: 'Tonalité d’une suite' });
  await button(page, 'Commencer').click();
  await expect(page.locator('.theory-prog')).toBeVisible();
});

test('chord progressions by ear, opened from the session', async ({ page }) => {
  await page.goto('#/pratiquer/sans-guitare');
  await page.locator('.off-step', { hasText: 'Suites d’accords' }).click();
  await expect(page.getByRole('button', { name: 'Suites d’accords' })).toHaveAttribute('aria-pressed', 'true');
  await button(page, 'Commencer').click();
  await expect(page.locator('.ear-choice')).toHaveCount(3);
  await page.locator('.ear-choice').first().click();
  await expect(page.locator('.ear-reveal')).toHaveText(/^En .+ (majeur|mineur) : .+ – .+ – .+ – .+$/);
});
