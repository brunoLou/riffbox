/**
 * Transfer between devices (phone ⇄ tablet) without a server: each item remembers when it was last
 * changed, deletions are remembered too, and receiving a file keeps, item by item, the most recent
 * version. Nothing is overwritten by an older copy, and nothing deleted comes back.
 */
import { readStored, registerWriteHook, serialized, writeStored } from './store';
import { markUsed } from './usage';

/** Collections of items with an `id`, synced item by item. */
export const SYNC_LISTS = ['ideas', 'grids', 'songs', 'setlists', 'voice.takes', 'tuner.custom', 'backing.mine'] as const;
/** Single values synced as a whole (the most recent wins). */
export const SYNC_VALUES = ['routine.steps', 'voice.range', 'grid.voicings', 'coach.profile', 'home.layout'] as const;
/** Device settings and bookkeeping that stay on each device. */
export const LOCAL_KEYS = ['settings.theme', 'pedal.keys', 'routine', 'practice.seeded', 'backup.last', 'backup.since',
  'backup.snooze', 'backup.remind', 'sync.lastSent', 'sync.lastReceived', 'stage.follow', 'usage.today',
  'coach.active', 'coach.day', 'coach.ownRoutine'];

export const DELETED_KEY = 'sync.deleted';
export const VALUE_TIMES_KEY = 'sync.valueTimes';
/** Deletions older than this are forgotten. */
const TOMBSTONE_DAYS = 365;

interface Item { id: string; updated?: number; created?: number }
type Tombstones = Record<string, number>;
const tombId = (list: string, id: string) => `${list}:${id}`;
/** When an item last changed: its stamp, else its creation, else never. */
export const changedAt = (x: Item) => x.updated ?? x.created ?? 0;

/**
 * Content of an item as saved, without its dates: two copies are the same if this is equal.
 * The creation date is left out too: the examples get theirs on each device's first launch,
 * and a real edit never changes it.
 */
function content(list: string, x: Item) {
  const [saved] = serialized(list, [x]) as Item[];
  const { updated: _u, created: _c, ...rest } = saved;
  return JSON.stringify(rest);
}

/**
 * Stamp `updated` on new and changed items (unchanged ones keep their date) and remember deleted
 * ids. `now` is injectable for tests.
 */
export function stampList(list: string, prev: Item[] | undefined, next: Item[], now = Date.now()): Item[] {
  if (!Array.isArray(next)) return next;
  const before = new Map((prev ?? []).map(x => [x.id, x]));
  const out = next.map(x => {
    if (!x || typeof x.id !== 'string') return x;
    const old = before.get(x.id);
    if (old && content(list, old) === content(list, x)) return old.updated === x.updated ? x : { ...x, updated: old.updated };
    return { ...x, updated: now };
  });
  if (prev) {
    const kept = new Set(next.map(x => x?.id));
    const gone = prev.filter(x => x && !kept.has(x.id));
    if (gone.length) {
      const t = { ...readStored<Tombstones>(DELETED_KEY, {}) };
      gone.forEach(x => (t[tombId(list, x.id)] = now));
      writeStored(DELETED_KEY, pruneTombstones(t, now));
    }
  }
  return out;
}

function pruneTombstones(t: Tombstones, now = Date.now()): Tombstones {
  const limit = now - TOMBSTONE_DAYS * 86400000;
  return Object.fromEntries(Object.entries(t).filter(([, at]) => at >= limit));
}

/** Home board tile lit when a collection changes. */
const TILE_OF: Record<(typeof SYNC_LISTS)[number], string> = {
  ideas: 'carnet', grids: 'grilles', songs: 'morceaux', setlists: 'setlists', 'voice.takes': 'voix', 'tuner.custom': 'tuner', 'backing.mine': 'backing',
};

/** Install the stamping on every write (once, at start-up). */
export function installSync() {
  for (const list of SYNC_LISTS) {
    registerWriteHook<Item[]>(list, (prev, next) => {
      const out = stampList(list, prev, next);
      // A real change (not the first save of the examples) lights the tool's LED on the home board.
      if (prev && Array.isArray(out)) {
        const sig = (xs: Item[]) => xs.map(x => `${x?.id}@${x?.updated}`).join();
        if (sig(prev) !== sig(out)) markUsed(TILE_OF[list]);
      }
      return out;
    });
  }
  for (const key of SYNC_VALUES) {
    registerWriteHook<unknown>(key, (prev, next) => {
      if (JSON.stringify(prev) !== JSON.stringify(next)) {
        writeStored(VALUE_TIMES_KEY, { ...readStored<Record<string, number>>(VALUE_TIMES_KEY, {}), [key]: Date.now() });
      }
      return next;
    });
  }
}

/* ---------- Merge ---------- */

export interface MergeStats { added: number; updated: number; removed: number }
export interface MergePlan {
  /** New value of every key that changes. */
  writes: Record<string, unknown>;
  /** Ids whose recording should come from the file (new or newer items). */
  audioIds: string[];
  stats: MergeStats;
  /** Per collection, for the preview. */
  byList: Record<string, MergeStats>;
}

/**
 * What receiving `theirs` (another device's data) changes here. `mine` reads local values,
 * `defaults` gives a collection's value before it was ever saved (the examples).
 */
export function planMerge(
  theirs: Record<string, unknown>,
  mine: (key: string) => unknown,
  defaults: Record<string, unknown> = {},
  now = Date.now(),
): MergePlan {
  const writes: Record<string, unknown> = {};
  const audioIds: string[] = [];
  const stats: MergeStats = { added: 0, updated: 0, removed: 0 };
  const byList: Record<string, MergeStats> = {};
  const myTombs = (mine(DELETED_KEY) as Tombstones | undefined) ?? {};
  const theirTombs = (theirs[DELETED_KEY] as Tombstones | undefined) ?? {};

  for (const list of SYNC_LISTS) {
    const s: MergeStats = { added: 0, updated: 0, removed: 0 };
    // An example never changed by the player has no date that counts: it never wins over a real
    // edit, whenever each device was first launched (the examples get their dates at launch).
    const examples = new Map(((defaults[list] ?? []) as Item[]).filter(x => x && typeof x.id === 'string').map(x => [x.id, content(list, x)]));
    const at = (x: Item) => (examples.get(x.id) === content(list, x) ? 0 : changedAt(x));
    const local = ((mine(list) ?? defaults[list] ?? []) as Item[]).filter(x => x && typeof x.id === 'string');
    const incoming = Array.isArray(theirs[list]) ? (theirs[list] as Item[]).filter(x => x && typeof x.id === 'string') : null;
    let result = local.slice();
    const index = new Map(result.map((x, i) => [x.id, i]));
    if (incoming) {
      for (const t of incoming) {
        const deletedHere = myTombs[tombId(list, t.id)];
        if (deletedHere !== undefined && deletedHere >= at(t)) continue; // deleted here afterwards
        const i = index.get(t.id);
        if (i === undefined) { result.push(t); index.set(t.id, result.length - 1); s.added++; audioIds.push(t.id); }
        else if (at(t) > at(result[i]) && content(list, t) !== content(list, result[i])) { result[i] = t; s.updated++; audioIds.push(t.id); }
      }
    }
    // Deleted on the other device after the last change here.
    const before = result.length;
    result = result.filter(x => { const gone = theirTombs[tombId(list, x.id)]; return !(gone !== undefined && gone > at(x)); });
    s.removed = before - result.length;
    if (s.added || s.updated || s.removed) writes[list] = result;
    byList[list] = s;
    stats.added += s.added; stats.updated += s.updated; stats.removed += s.removed;
  }

  // Single values: the most recently changed wins.
  const myTimes = (mine(VALUE_TIMES_KEY) as Record<string, number> | undefined) ?? {};
  const theirTimes = (theirs[VALUE_TIMES_KEY] as Record<string, number> | undefined) ?? {};
  const times = { ...myTimes };
  for (const key of SYNC_VALUES) {
    if (!(key in theirs)) continue;
    const mineSet = mine(key) !== undefined;
    if (!mineSet || (theirTimes[key] ?? 0) > (myTimes[key] ?? 0)) {
      if (JSON.stringify(mine(key)) !== JSON.stringify(theirs[key])) { writes[key] = theirs[key]; stats.updated++; }
      times[key] = Math.max(theirTimes[key] ?? 0, myTimes[key] ?? 0);
    }
  }
  if (JSON.stringify(times) !== JSON.stringify(myTimes)) writes[VALUE_TIMES_KEY] = times;

  // Practice minutes: the larger value per day (the same session is not counted twice).
  const theirLog = theirs['practice.log'];
  if (theirLog && typeof theirLog === 'object') {
    const myLog = (mine('practice.log') as Record<string, number> | undefined) ?? {};
    const log = { ...myLog };
    for (const [day, min] of Object.entries(theirLog as Record<string, number>)) if (typeof min === 'number') log[day] = Math.max(log[day] ?? 0, min);
    if (JSON.stringify(log) !== JSON.stringify(myLog)) writes['practice.log'] = log;
  }

  // Deletions known on either side, so they keep travelling.
  const tombs = { ...myTombs };
  for (const [k, at] of Object.entries(theirTombs)) if (typeof at === 'number') tombs[k] = Math.max(tombs[k] ?? 0, at);
  const pruned = pruneTombstones(tombs, now);
  if (JSON.stringify(pruned) !== JSON.stringify(myTombs)) writes[DELETED_KEY] = pruned;

  // Anything else (preferences of features not used here yet) only fills a gap.
  const handled = new Set<string>([...SYNC_LISTS, ...SYNC_VALUES, VALUE_TIMES_KEY, DELETED_KEY, 'practice.log', ...LOCAL_KEYS]);
  for (const [k, v] of Object.entries(theirs)) if (!handled.has(k) && mine(k) === undefined && !(k in defaults)) writes[k] = v;

  return { writes, audioIds, stats, byList };
}

/** « 3 éléments ajoutés, 2 mis à jour et 1 supprimé », or « Déjà à jour ». */
export function mergeSummary(s: MergeStats): string {
  const parts = [
    s.added && `${s.added} ${s.added > 1 ? 'ajoutés' : 'ajouté'}`,
    s.updated && `${s.updated} mis à jour`,
    s.removed && `${s.removed} ${s.removed > 1 ? 'supprimés' : 'supprimé'}`,
  ].filter(Boolean) as string[];
  if (!parts.length) return 'Déjà à jour : rien de nouveau';
  const n = s.added + s.updated + s.removed;
  return `${n > 1 ? 'Éléments' : 'Élément'} : ${parts.join(', ').replace(/, ([^,]*)$/, ' et $1')}`;
}
