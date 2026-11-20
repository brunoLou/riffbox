import { readStored } from './store';

export type ThemePref = 'dark' | 'light' | 'auto';
export const THEME_KEY = 'settings.theme';

const light = () => window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false;

/** Apply a theme to the whole app (and the browser bar colour). Dark is the default. */
export function applyTheme(pref: ThemePref) {
  const theme = pref === 'auto' ? (light() ? 'light' : 'dark') : pref;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f6f1e8' : '#1a1816');
}

/** At startup: apply the saved choice and follow the system while it is on "auto". */
export function initTheme() {
  applyTheme(readStored<ThemePref>(THEME_KEY, 'dark'));
  window.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', () => {
    if (readStored<ThemePref>(THEME_KEY, 'dark') === 'auto') applyTheme('auto');
  });
}
