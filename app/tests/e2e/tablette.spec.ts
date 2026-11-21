import { devices } from '@playwright/test';
import { expect, test } from './helpers';

/** An iPad's screen and touch, in the Chromium used by every test (not the device's WebKit). */
const ipad = (name: string) => {
  const { viewport, deviceScaleFactor, isMobile, hasTouch, userAgent } = devices[name];
  return { viewport, deviceScaleFactor, isMobile, hasTouch, userAgent };
};
const box = (page: import('@playwright/test').Page, sel: string) => page.locator(sel).first().boundingBox().then(b => b!);

test.describe('tablet, portrait', () => {
  test.use(ipad('iPad (gen 7)'));

  test('full screen, no device frame; most screens are a centred column', async ({ page }) => {
    await page.goto('#/');
    await expect(page.locator('.phone')).toHaveCSS('border-radius', '0px');
    await expect(page.locator('.statusbar > span').first()).toHaveCSS('visibility', 'hidden');
    const phone = await box(page, '.phone');
    expect(phone.height).toBe(1080);
    expect(phone.width).toBe(720);
    expect(phone.x).toBe(45);
  });

  test('the stage takes the whole width with bigger lyrics', async ({ page }) => {
    await page.goto('#/scene/bar-du-port/play/2');
    expect((await box(page, '.phone')).width).toBe(810);
    // 26 px by default, ×1.45 on a tablet.
    const size = await page.locator('.lyric-text').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeCloseTo(37.7, 0);
  });

  test('the neck shows whole, without scrolling', async ({ page }) => {
    for (const r of ['/pratiquer/gammes', '/pratiquer/accords']) {
      await page.goto('#' + r);
      const [scroll, client] = await page.locator('.neck-scroll').evaluate(el => [el.scrollWidth, el.clientWidth]);
      expect(scroll, r).toBeLessThanOrEqual(client);
    }
  });
});

test.describe('tablet, landscape', () => {
  test.use(ipad('iPad (gen 7) landscape'));

  test('the grid puts the circle of fifths beside the chords', async ({ page }) => {
    await page.goto('#/composer/grille/g-minuit');
    const slots = await box(page, '.slots');
    const wheel = await box(page, '.wheel');
    expect(wheel.x).toBeGreaterThan(slots.x + slots.width);
    // Everything fits above the tab bar.
    expect(wheel.y + wheel.height).toBeLessThan((await box(page, '.tabbar')).y);
    // Still usable: touching a chord on the circle adds it.
    await page.locator('.seg button', { hasText: 'Pont' }).click();
    const before = await page.locator('.slot').count();
    await page.locator('.wheel-chord', { has: page.locator('.wc-name', { hasText: /^C#m$/ }) }).click();
    await expect(page.locator('.slot')).toHaveCount(before + 1);
  });

  test('a sheet keeps a readable width', async ({ page }) => {
    await page.goto('#/composer/grille/g-minuit');
    await page.getByLabel('Accord D : diagramme').click();
    expect((await box(page, '.chord-sheet')).width).toBeLessThanOrEqual(720);
  });
});

test('on a computer the app stays framed as a phone', async ({ page }) => {
  await page.goto('#/');
  await expect(page.locator('.phone')).toHaveCSS('border-radius', '52px');
  expect((await box(page, '.phone')).width).toBe(390);
});
