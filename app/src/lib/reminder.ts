/**
 * Backup reminder: everything lives on this phone only, so after a while without an export the
 * home screen suggests one. Only when the player has content of their own (not just the examples).
 */
import { INITIAL_GRIDS, type Grid } from './grids';
import { INITIAL_IDEAS, type Idea } from './ideas';
import { INITIAL_SETLISTS, INITIAL_SONGS, type Setlist, type Song } from './setlists';
import { readStored, writeStored } from './store';
import { CUSTOM_KEY } from './tunings';
import { TAKES_KEY } from './voice';

export const LAST_BACKUP_KEY = 'backup.last';
/** Days between reminders; 0 = never. */
export const REMIND_KEY = 'backup.remind';
export const REMIND_CHOICES: { days: number; label: string }[] = [
  { days: 0, label: 'Jamais' }, { days: 7, label: '1 semaine' }, { days: 14, label: '2 semaines' }, { days: 30, label: '1 mois' },
];
export const REMIND_DEFAULT = 14;
const SINCE_KEY = 'backup.since';
const SNOOZE_KEY = 'backup.snooze';
export const SNOOZE_DAYS = 7;
const DAY = 86400000;

const own = <T extends { id: string }>(list: T[], demo: { id: string }[]) => {
  const ids = new Set(demo.map(x => x.id));
  return list.filter(x => !ids.has(x.id)).length;
};

/** How many things the player made themselves (examples don't count). */
export function ownContent(): number {
  return own(readStored<Idea[]>('ideas', INITIAL_IDEAS), INITIAL_IDEAS)
    + own(readStored<Grid[]>('grids', INITIAL_GRIDS), INITIAL_GRIDS)
    + own(readStored<Song[]>('songs', INITIAL_SONGS), INITIAL_SONGS)
    + own(readStored<Setlist[]>('setlists', INITIAL_SETLISTS), INITIAL_SETLISTS)
    + readStored<unknown[]>(TAKES_KEY, []).length
    + readStored<unknown[]>(CUSTOM_KEY, []).length;
}

export const lastBackup = () => {
  const iso = readStored<string | null>(LAST_BACKUP_KEY, null);
  return iso ? new Date(iso).getTime() : null;
};
export const markBackedUp = (iso = new Date().toISOString()) => writeStored(LAST_BACKUP_KEY, iso);

/** The reminder to show now, or null. */
export function backupReminder(now = Date.now()): { days: number; never: boolean } | null {
  const every = readStored<number>(REMIND_KEY, REMIND_DEFAULT);
  if (!every || !ownContent()) return null;
  // Without a backup, count from the moment the app first saw the player's own content.
  let since = readStored<number | null>(SINCE_KEY, null);
  if (since === null) { since = now; writeStored(SINCE_KEY, since); }
  const last = lastBackup();
  const ref = last ?? since;
  const days = Math.floor((now - ref) / DAY);
  if (days < every) return null;
  if (readStored<number>(SNOOZE_KEY, 0) > now) return null;
  return { days, never: last === null };
}

export const snoozeReminder = (now = Date.now()) => writeStored(SNOOZE_KEY, now + SNOOZE_DAYS * DAY);

/** "aujourd’hui", "hier", "il y a 12 jours" */
export const daysAgo = (days: number) => (days <= 0 ? 'aujourd’hui' : days === 1 ? 'hier' : `il y a ${days} jours`);
