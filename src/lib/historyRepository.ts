import type { RelationshipHistoryEntry } from '@/types';

/**
 * Relationship History Repository
 *
 * localStorage에 직접 접근하는 유일한 지점이다 — UI 컴포넌트에서 localStorage를 부르지 않는다(§5).
 * 세션(`lym.session.v1`)과 저장소를 완전히 분리한다: 세션 초기화는 History를 지우지 않고,
 * 사용자의 '전체 데이터 삭제'만 History까지 지운다(§30/§31).
 *
 * 항목은 항상 createdAt 오름차순(오래된 것 → 최신)으로 정렬해서 돌려준다.
 */

const STORAGE_KEY = 'lym.history.v1';

function isEntry(value: unknown): value is RelationshipHistoryEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Partial<RelationshipHistoryEntry>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.analysisId === 'string' &&
    typeof entry.createdAt === 'string' &&
    typeof entry.mirrorSnapshot === 'object' &&
    entry.mirrorSnapshot !== null &&
    Array.isArray(entry.mirrorSnapshot.insights)
  );
}

function sortByCreatedAt(entries: RelationshipHistoryEntry[]): RelationshipHistoryEntry[] {
  return [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function write(entries: RelationshipHistoryEntry[]): RelationshipHistoryEntry[] {
  const sorted = sortByCreatedAt(entries);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
  } catch {
    // 저장 실패가 흐름을 막지 않는다 (세션 저장과 같은 정책)
  }
  return sorted;
}

export function getHistory(): RelationshipHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 스키마가 안 맞는 항목은 조용히 버린다 — 깨진 기록으로 화면을 터뜨리지 않는다.
    return sortByCreatedAt(parsed.filter(isEntry));
  } catch {
    return [];
  }
}

export function getHistoryEntry(id: string): RelationshipHistoryEntry | null {
  return getHistory().find((entry) => entry.id === id) ?? null;
}

export function getLatestHistoryEntry(): RelationshipHistoryEntry | null {
  const entries = getHistory();
  return entries.length > 0 ? entries[entries.length - 1]! : null;
}

/** 최신 직전 항목 — 변화 비교의 PAST 쪽 */
export function getPreviousHistoryEntry(): RelationshipHistoryEntry | null {
  const entries = getHistory();
  return entries.length >= 2 ? entries[entries.length - 2]! : null;
}

/** 같은 분석이 이미 저장돼 있는지 (§7 중복 저장 방지) */
export function hasHistoryEntryForAnalysis(analysisId: string): RelationshipHistoryEntry | null {
  return getHistory().find((entry) => entry.analysisId === analysisId) ?? null;
}

/**
 * 항목 추가. 같은 analysisId가 이미 있으면 **새로 만들지 않고 기존 항목을 돌려준다**(§7).
 * @returns 저장(또는 기존) 항목과, 실제로 새로 만들어졌는지 여부
 */
export function addHistoryEntry(entry: RelationshipHistoryEntry): {
  entry: RelationshipHistoryEntry;
  created: boolean;
  entries: RelationshipHistoryEntry[];
} {
  const entries = getHistory();
  const existing = entries.find((item) => item.analysisId === entry.analysisId);

  if (existing) {
    return { entry: existing, created: false, entries };
  }

  const next = write([...entries, entry]);
  return { entry, created: true, entries: next };
}

export function updateHistoryEntry(
  id: string,
  patch: Partial<RelationshipHistoryEntry>,
): RelationshipHistoryEntry[] {
  return write(
    getHistory().map((entry) => (entry.id === id ? { ...entry, ...patch, id: entry.id } : entry)),
  );
}

export function deleteHistoryEntry(id: string): RelationshipHistoryEntry[] {
  return write(getHistory().filter((entry) => entry.id !== id));
}

export function clearHistory(): RelationshipHistoryEntry[] {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 무시
  }
  return [];
}

/** 항목 id 생성 — 저장 지점에서만 호출한다(로직 파일은 시간·난수를 모른다) */
export function createEntryId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // 아래 폴백 사용
  }
  return `h_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}
