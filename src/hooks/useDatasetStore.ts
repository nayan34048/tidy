import { useCallback, useMemo, useState } from 'react';
import type { Dataset, DatasetSession, HistoryEntry } from '../types/dataset';
import type { OpResult } from '../lib/clean';
import { uid } from '../utils/id';

export interface DatasetStore {
  session: DatasetSession | null;
  current: Dataset | null;
  original: Dataset | null;
  canUndo: boolean;
  canRedo: boolean;
  load: (ds: Dataset) => void;
  apply: (result: OpResult) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  clearHistory: () => void;
  close: () => void;
}

const MAX_SNAPSHOTS = 100;

export function useDatasetStore(): DatasetStore {
  const [session, setSession] = useState<DatasetSession | null>(null);

  const load = useCallback((ds: Dataset) => {
    setSession({ snapshots: [ds], pointer: 0, history: [] });
  }, []);

  const apply = useCallback((result: OpResult) => {
    setSession((prev) => {
      if (!prev) return prev;
      if (result.dataset === prev.snapshots[prev.pointer]) return prev; // no-op guard
      const snapshots = prev.snapshots.slice(0, prev.pointer + 1);
      const history = prev.history.slice(0, prev.pointer);
      snapshots.push(result.dataset);
      history.push({ id: uid('step'), label: result.label, code: result.code, timestamp: Date.now() });
      // Cap history length so long sessions don't grow memory unbounded.
      const overflow = snapshots.length - MAX_SNAPSHOTS;
      if (overflow > 0) {
        snapshots.splice(1, overflow); // always keep the original at index 0
        history.splice(0, overflow);
      }
      return { snapshots, pointer: snapshots.length - 1, history };
    });
  }, []);

  const undo = useCallback(() => {
    setSession((prev) => (prev && prev.pointer > 0 ? { ...prev, pointer: prev.pointer - 1 } : prev));
  }, []);

  const redo = useCallback(() => {
    setSession((prev) =>
      prev && prev.pointer < prev.snapshots.length - 1 ? { ...prev, pointer: prev.pointer + 1 } : prev
    );
  }, []);

  const reset = useCallback(() => {
    setSession((prev) => (prev ? { snapshots: [prev.snapshots[0]], pointer: 0, history: [] } : prev));
  }, []);

  const clearHistory = useCallback(() => {
    setSession((prev) => (prev ? { snapshots: [prev.snapshots[prev.pointer]], pointer: 0, history: [] } : prev));
  }, []);

  const close = useCallback(() => setSession(null), []);

  const current = session ? session.snapshots[session.pointer] : null;
  const original = session ? session.snapshots[0] : null;
  const canUndo = !!session && session.pointer > 0;
  const canRedo = !!session && session.pointer < session.snapshots.length - 1;

  return useMemo(
    () => ({ session, current, original, canUndo, canRedo, load, apply, undo, redo, reset, clearHistory, close }),
    [session, current, original, canUndo, canRedo, load, apply, undo, redo, reset, clearHistory, close]
  );
}

export function historyLabels(history: HistoryEntry[]): string[] {
  return history.map((h) => h.label);
}
