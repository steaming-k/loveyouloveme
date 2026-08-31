'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import * as repo from '@/lib/historyRepository';
import type { RelationshipHistoryEntry } from '@/types';

/**
 * Relationship History 상태
 *
 * 세션(`SessionProvider`)과 분리된 영구 데이터다. 화면은 이 Provider만 쓰고
 * `historyRepository`나 localStorage를 직접 부르지 않는다(§5).
 */

interface HistoryContextValue {
  /** 오래된 것 → 최신 순 */
  entries: RelationshipHistoryEntry[];
  hydrated: boolean;

  latest: RelationshipHistoryEntry | null;
  previous: RelationshipHistoryEntry | null;

  getEntry: (id: string) => RelationshipHistoryEntry | null;
  findByAnalysis: (analysisId: string) => RelationshipHistoryEntry | null;

  /** 같은 analysisId가 있으면 새로 만들지 않고 기존 항목을 돌려준다(§7) */
  saveEntry: (entry: RelationshipHistoryEntry) => {
    entry: RelationshipHistoryEntry;
    created: boolean;
  };
  updateEntry: (id: string, patch: Partial<RelationshipHistoryEntry>) => void;
  deleteEntry: (id: string) => void;
  clearAll: () => void;
}

const HistoryContext = createContext<HistoryContextValue | null>(null);

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<RelationshipHistoryEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setEntries(repo.getHistory());
    setHydrated(true);
  }, []);

  const getEntry = useCallback(
    (id: string) => entries.find((entry) => entry.id === id) ?? null,
    [entries],
  );

  const findByAnalysis = useCallback(
    (analysisId: string) => entries.find((entry) => entry.analysisId === analysisId) ?? null,
    [entries],
  );

  const saveEntry = useCallback((entry: RelationshipHistoryEntry) => {
    const result = repo.addHistoryEntry(entry);
    setEntries(result.entries);
    return { entry: result.entry, created: result.created };
  }, []);

  const updateEntry = useCallback((id: string, patch: Partial<RelationshipHistoryEntry>) => {
    setEntries(repo.updateHistoryEntry(id, patch));
  }, []);

  const deleteEntry = useCallback((id: string) => {
    // 삭제 후 latest/previous/변화 리포트/반복 신호는 entries에서 파생되므로 자동 재계산된다(§29).
    setEntries(repo.deleteHistoryEntry(id));
  }, []);

  const clearAll = useCallback(() => {
    setEntries(repo.clearHistory());
  }, []);

  const value = useMemo<HistoryContextValue>(
    () => ({
      entries,
      hydrated,
      latest: entries.length > 0 ? entries[entries.length - 1]! : null,
      previous: entries.length >= 2 ? entries[entries.length - 2]! : null,
      getEntry,
      findByAnalysis,
      saveEntry,
      updateEntry,
      deleteEntry,
      clearAll,
    }),
    [entries, hydrated, getEntry, findByAnalysis, saveEntry, updateEntry, deleteEntry, clearAll],
  );

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}

export function useHistory(): HistoryContextValue {
  const context = useContext(HistoryContext);
  if (!context) throw new Error('useHistory must be used inside <HistoryProvider>');
  return context;
}
