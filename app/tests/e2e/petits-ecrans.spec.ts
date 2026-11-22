import { expect, test } from './helpers';

const ROUTES = ['/', '/accordeur', '/metronome', '/composer', '/composer/grille/g-minuit', '/pratiquer', '/pratiquer/routine',
  '/pratiquer/routine/modifier', '/pratiquer/gammes', '/pratiquer/accords', '/pratiquer/backing', '/voix', '/voix/exercices',
  '/voix/tessiture', '/voix/tonalite', '/voix/ex/gamme5', '/outils/capo', '/outils/ton', '/pratiquer/looper', '/scene', '/scene/bar-du-port', '/scene/morceaux',
  '/scene/morceau/s3', '/reglages'];
/** Controls fixed at the bottom of a screen. */
const BARS = '.cta, .grid-actions, .carnet-actions, .rtransport, .tabbar, .player';

for (const [w, h] of [[360, 640], [390, 700], [412, 780]]) {
  test.describe(`phone ${w}×${h}`, () => {
    test.use({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });

    test('nothing stays hidden under the main button or the tab bar once scrolled down', async ({ page }) => {
      test.setTimeout(90_000);
      for (const r of ROUTES) {
        await page.goto('#' + r);
        await expect(page.locator('.tabbar')).toBeVisible();
        const hidden = await page.evaluate(bars => {
          // Scroll every scrolling area to its end, as the player would.
          document.querySelectorAll<HTMLElement>('*').forEach(e => {
            if (e.scrollHeight > e.clientHeight + 2 && getComputedStyle(e).overflowY !== 'visible') e.scrollTop = e.scrollHeight;
          });
          const top = Math.min(...[...document.querySelectorAll(bars)].map(e => e.getBoundingClientRect().top));
          return [...document.querySelectorAll<HTMLElement>('.phone button, .phone a, .phone input, .phone select, .phone [role="button"], .phone p')]
            .filter(e => !e.closest(bars) && !e.closest('[role="dialog"]') && e.getClientRects().length)
            .filter(e => { const b = e.getBoundingClientRect(); return b.bottom > top + 4 && b.top < innerHeight; })
            .map(e => (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30));
        }, BARS);
        expect(hidden, r).toEqual([]);
      }
    });
  });
}
