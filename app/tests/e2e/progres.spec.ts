import { expect, test } from './helpers';

test('progress: twelve weeks of practice, the coach’s tempos, check-ups and ear scores', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('prepared')) return;
    sessionStorage.setItem('prepared', '1');
    const set = (k: string, v: unknown) => localStorage.setItem('riffbox:v1:' + k, JSON.stringify(v));
    const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
    const d = new Date(Date.now() - 8 * 86400000);
    set('practice.log', { [`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`]: 45 });
    set('coach.progress', { rhythm: { bpm: 98, history: [{ day: day - 4, bpm: 90, feel: 'easy' }, { day: day - 2, bpm: 94, feel: 'easy' }] } });
    set('coach.tests', [{ date: Date.now() - 40 * 86400000, measures: { changes: 10 } }, { date: Date.now(), measures: { changes: 22 } }]);
    set('ear.stats', { intervals: { '7': { ok: 3, n: 4 } } });
  });
  await page.goto('#/pratiquer');
  await page.getByRole('button', { name: 'Voir mes progrès ›' }).click();
  await expect(page).toHaveURL(/#\/pratiquer\/progres$/);

  const weeks = page.getByRole('region', { name: 'Pratique par semaine' });
  await expect(weeks.locator('.week-col')).toHaveCount(12);
  await expect(weeks.locator('.week-foot')).toContainText('(en cours)');
  await weeks.getByRole('button', { name: /: 45 min$/ }).click();
  await expect(weeks.locator('.week-foot')).toContainText('45 min');
  await weeks.getByRole('button', { name: 'Voir en tableau' }).click();
  await expect(weeks.locator('tbody tr')).toHaveCount(12);
  await expect(weeks.locator('tbody')).toContainText('45 min');

  const tempos = page.getByRole('region', { name: 'Tempos du coach' });
  await expect(tempos.getByRole('img', { name: 'Rythme : de 90 à 98 BPM en 2 séances' })).toBeVisible();
  await expect(tempos.locator('.prog-read')).toHaveText('Prochaine séance : 98 BPM');
  await tempos.locator('.prog-line').click({ position: { x: 5, y: 40 } });
  await expect(tempos.locator('.prog-read')).toContainText('90 BPM · facile');

  await expect(page.getByRole('region', { name: 'Bilans du coach' }).locator('.prog-tile')).toContainText(['Accords10 → 22changements / min · mieux']);
  await expect(page.getByRole('region', { name: 'Oreille' }).locator('.prog-tile')).toContainText(['Intervalles75 %sur 4 essais']);
});

test('progress: with nothing yet, each part says how to fill it', async ({ page }) => {
  await page.goto('#/pratiquer/progres');
  await expect(page.getByRole('region', { name: 'Tempos du coach' })).toContainText('facile, juste ou difficile');
  await expect(page.getByRole('region', { name: 'Bilans du coach' })).toContainText('test du mois');
  await expect(page.getByRole('region', { name: 'Oreille' })).toHaveCount(0);
});
