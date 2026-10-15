'use client';
import { useEffect, useState, useCallback } from 'react';
import { emptyHistory, HISTORY_KEY, type ProgressInput } from './play-history';
import { readHistory, persistGameProgress, resetSoloHistory } from './history-store';
export function useGameHistory() {
  const [history, setHistory] = useState(emptyHistory);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void readHistory().then((h) => {
        if (active) setHistory(h);
      });
    };
    refresh();
    const listener = (e: StorageEvent) => {
      if (e.key === HISTORY_KEY) refresh();
    };
    window.addEventListener('storage', listener);
    return () => {
      active = false;
      window.removeEventListener('storage', listener);
    };
  }, []);
  const save = useCallback(async (input: ProgressInput) => {
    const h = await persistGameProgress(input);
    setHistory(h);
    return h;
  }, []);
  const resetSolo = useCallback(async () => {
    const h = await resetSoloHistory();
    setHistory(h);
    return h;
  }, []);
  return { history, save, resetSolo };
}
