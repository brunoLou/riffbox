import { expect, test } from './helpers';

test.use({ serviceWorkers: 'allow' });

test('installable, and works offline after the first visit', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  const cdp = await context.newCDPSession(page);
  expect((await cdp.send('Page.getInstallabilityErrors')).installabilityErrors).toEqual([]);
  expect((await cdp.send('Page.getAppManifest')).errors).toEqual([]);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.display').first()).toHaveText('MON PEDALBOARD');
  for (const [route, title] of [['/metronome', 'MÉTRONOME'], ['/composer', 'CARNET D’IDÉES'], ['/pratiquer/accords', 'ACCORDS'], ['/scene/bar-du-port/play/2', 'MINUIT SHUFFLE']]) {
    await page.evaluate(h => { location.hash = h; }, route);
    await expect(page.locator('.display').first()).toHaveText(title);
  }
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return ['900 20px "Big Shoulders Display"', '700 20px "Barlow"', '700 20px "Space Mono"'].map(f => document.fonts.check(f));
  });
  expect(fonts).toEqual([true, true, true]);
  await context.setOffline(false);
});
