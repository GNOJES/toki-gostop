import {
  HISTORY_KEY,
  applyProgress,
  emptyHistory,
  parseHistory,
  resetSolo,
  type PlayHistory,
  type ProgressInput,
} from './play-history';
export const HISTORY_DB = 'toki-gostop-history-v1';
let memory = emptyHistory();
const memorySeen = new Set<string>(),
  memoryDone = new Set<string>();
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HISTORY_DB, 1);
    req.onupgradeneeded = () => {
      for (const n of ['history', 'appliedTransfers', 'completedGames'])
        req.result.createObjectStore(n);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(Error('다른 창에서 기록을 사용 중이에요.'));
    req.onsuccess = () => {
      req.result.onversionchange = () => req.result.close();
      resolve(req.result);
    };
  });
}
type Change = (h: PlayHistory, seen: Set<string>, done: Set<string>) => PlayHistory;
async function update(change: Change, publish = true): Promise<PlayHistory> {
  if (typeof indexedDB === 'undefined') {
    memory = change(memory, memorySeen, memoryDone);
    return memory;
  }
  try {
    const db = await open();
    return await new Promise<PlayHistory>((resolve, reject) => {
      const tx = db.transaction(['history', 'appliedTransfers', 'completedGames'], 'readwrite');
      const store = tx.objectStore('history'),
        applied = tx.objectStore('appliedTransfers'),
        completed = tx.objectStore('completedGames');
      const requests = [store.get('current'), applied.getAllKeys(), completed.getAllKeys()];
      let pending = 3,
        next: PlayHistory;
      let seen: Set<string>, done: Set<string>;
      for (const req of requests)
        req.onsuccess = () => {
          if (--pending) return;
          try {
            seen = new Set(requests[1].result as string[]);
            done = new Set(requests[2].result as string[]);
            next = change(
              parseHistory(JSON.stringify(requests[0].result ?? emptyHistory())),
              seen,
              done,
            );
            store.put(next, 'current');
            for (const id of seen) applied.put(true, id);
            for (const id of done) completed.put(true, id);
          } catch {
            tx.abort();
          }
        };
      tx.oncomplete = () => {
        db.close();
        memory = next;
        for (const id of seen) memorySeen.add(id);
        for (const id of done) memoryDone.add(id);
        try {
          if (publish) localStorage.setItem(HISTORY_KEY, `${Date.now()}:${Math.random()}`);
        } catch {}
        resolve(next);
      };
      tx.onabort = tx.onerror = () => {
        db.close();
        reject(tx.error ?? Error('기록 저장 실패'));
      };
    });
  } catch {
    memory = change(memory, memorySeen, memoryDone);
    return memory;
  }
}
export const persistGameProgress = (input: ProgressInput) =>
  update((h, seen, done) => applyProgress(h, input, seen, done));
export const readHistory = () => update((h) => h, false);
export const resetSoloHistory = () => update((h) => resetSolo(h));
