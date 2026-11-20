/** Audio recordings are kept in IndexedDB (localStorage can't hold binary data). */

const DB = 'riffbox', STORE = 'audio';
let dbp: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbp.catch(() => { dbp = null; });
  }
  return dbp;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(d => new Promise<T>((resolve, reject) => {
    const req = fn(d.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

export const putBlob = (id: string, blob: Blob) => run('readwrite', s => s.put(blob, id)).then(() => true, () => false);
export const getBlob = (id: string) => run<Blob | undefined>('readonly', s => s.get(id)).catch(() => undefined);
export const deleteBlob = (id: string) => run('readwrite', s => s.delete(id)).catch(() => undefined);
export const clearBlobs = () => run('readwrite', s => s.clear()).catch(() => undefined);
/** Total size of the saved recordings, in bytes. */
export const blobsBytes = () => run<Blob[]>('readonly', s => s.getAll() as IDBRequest<Blob[]>).then(l => l.reduce((t, b) => t + b.size, 0)).catch(() => 0);
