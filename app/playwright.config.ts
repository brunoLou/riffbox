import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests: the built app (vite preview) in Chromium, at phone size.
 * Run `npx playwright install chromium` once on a new machine.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  // On CI: one retry (reported as « flaky »), and an HTML report kept when something fails.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:4173/',
    viewport: { width: 520, height: 960 },
    // The edit-mode wiggle and other animations off, so elements are stable.
    reducedMotion: 'reduce',
    // Most tests run without the service worker so each test starts from a fresh app (pwa.spec turns it on).
    serviceWorkers: 'block',
    trace: 'off',
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
