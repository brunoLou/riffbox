/**
 * Text shared to RIFFBOX from another app (Android: « Partager → RIFFBOX »). The app opens on
 * /share-target?title=…&text=…&url=…; the text is kept for Morceaux, which offers to import it.
 */
const KEY = 'riffbox-shared';
export interface Shared { title: string; text: string; url: string }

/** At start-up, before the screens: a share received? Keep it and go to Morceaux. */
export function consumeShare(): boolean {
  if (!/\/share-target\/?$/.test(location.pathname)) return false;
  const q = new URLSearchParams(location.search);
  const shared: Shared = { title: q.get('title') ?? '', text: q.get('text') ?? '', url: q.get('url') ?? '' };
  try { sessionStorage.setItem(KEY, JSON.stringify(shared)); } catch { /* private mode: lost */ }
  history.replaceState(null, '', location.pathname.replace(/share-target\/?$/, '') + '#/scene/morceaux');
  return true;
}

/** The share waiting to be imported (read once). */
export function takeShare(): Shared | null {
  try {
    const s = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return s ? JSON.parse(s) as Shared : null;
  } catch { return null; }
}

/** Only an address (the page was shared, not the song selected on it). */
export const onlyUrl = (s: Shared) => !s.text.trim() || /^\s*https?:\/\/\S+\s*$/.test(s.text);

/** A web search for the song's chords and lyrics, in the player's browser. */
export const searchUrl = (title: string, artist: string) =>
  'https://www.google.com/search?q=' + encodeURIComponent([`"${title.trim()}"`, artist.trim(), 'accords paroles'].filter(x => x && x !== '""').join(' '));
