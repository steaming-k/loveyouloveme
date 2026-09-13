import {
  PRIMARY_KEY,
  type PersistenceRows,
  type PersistenceTable,
  type RelationshipEventRow,
  type RelationshipTargetRow,
} from '@/lib/supabase/types';

import type { InsertRow, PersistenceGateway, SelectOptions } from './gateway';
import { fail, ok, type Result } from './types';

/**
 * v1.47 — **메모리 gateway** (fixture · 오프라인 검증용)
 *
 * migration SQL의 규칙을 그대로 흉내 낸다. 규칙이 SQL과 어긋나면 이 구현이 틀린 것이다.
 *
 * ```
 * RLS          모든 테이블 auth.uid() = user_id (SELECT/INSERT/UPDATE/DELETE)
 * FK           events/runs.(target_id, user_id) → targets.(id, user_id) · ON DELETE CASCADE
 * CHECK        event type 목록 · description 1..4000 · label 1..40
 * revision     UPDATE는 revision = expected일 때만, revision + 1
 * 불변         analysis_runs UPDATE 금지(정책 없음 + 트리거)
 * ```
 *
 * ⚠️ 실제 Postgres RLS를 검증하는 것이 아니다. 실제 검증은 dev/staging 프로젝트에서
 *    `docs/v147_supabase_persistence.md`의 RLS 체크리스트로 한다.
 */

type Tables = { [T in PersistenceTable]: PersistenceRows[T][] };

export interface MemoryDatabase {
  tables: Tables;
  /** 각 요청 앞에서 확인하는 장애 스위치 */
  offline: boolean;
}

export function createMemoryDatabase(): MemoryDatabase {
  return {
    tables: { user_profiles: [], relationship_targets: [], relationship_events: [], analysis_runs: [] },
    offline: false,
  };
}

const EVENT_TYPES = new Set([
  'affection_felt',
  'conflict',
  'contact_change',
  'closer',
  'distance',
  'care_received',
  'meeting',
  'other',
]);

function clone<T>(value: T): T {
  return structuredClone(value);
}

let tick = 0;
function nowIso(): string {
  /* 같은 밀리초에 여러 행이 생겨도 순서가 보존되게 1ms씩 민다 */
  tick += 1;
  return new Date(Date.UTC(2026, 8, 14, 0, 0, 0) + tick).toISOString();
}

function keyOf<T extends PersistenceTable>(table: T, row: PersistenceRows[T]): string {
  return String((row as unknown as Record<string, unknown>)[PRIMARY_KEY[table]]);
}

function checkRow<T extends PersistenceTable>(db: MemoryDatabase, table: T, row: PersistenceRows[T]): Result<true> {
  if (table === 'relationship_targets') {
    const target = row as RelationshipTargetRow;
    if (target.label !== null && (target.label.length < 1 || target.label.length > 40)) {
      return fail('invalid', 'check:label');
    }
  }
  if (table === 'relationship_events') {
    const event = row as RelationshipEventRow;
    if (!EVENT_TYPES.has(event.type)) return fail('invalid', 'check:type');
    if (event.description.length < 1 || event.description.length > 4000) return fail('invalid', 'check:description');
  }
  if (table === 'relationship_events' || table === 'analysis_runs') {
    const child = row as { target_id: string | null; user_id: string };
    if (child.target_id !== null) {
      const parent = db.tables.relationship_targets.find(
        (target) => target.id === child.target_id && target.user_id === child.user_id,
      );
      if (!parent) return fail('invalid', 'fk:target_owner');
    }
  }
  return ok(true);
}

export interface MemoryGateway extends PersistenceGateway {
  setUser(userId: string | null): void;
  /** 정책상 존재하지 않는 경로를 **시도**해 본다 — 불변성 검증 전용 */
  attemptRawUpdate(table: PersistenceTable, key: string, patch: Record<string, unknown>): Promise<Result<{ updated: number }>>;
}

export function createMemoryGateway(db: MemoryDatabase, initialUserId: string | null): MemoryGateway {
  let uid = initialUserId;

  const guard = (): Result<string> | null => {
    if (db.offline) return fail('offline', 'request_failed:offline');
    if (!uid) return fail('unauthorized', 'no_session');
    return null;
  };

  return {
    setUser(userId) {
      uid = userId;
    },

    async currentUserId() {
      if (db.offline) return fail('offline', 'request_failed:offline');
      return uid ? ok(uid) : fail('unauthorized', 'no_session');
    },

    async select<T extends PersistenceTable>(table: T, filter: Partial<PersistenceRows[T]>, options?: SelectOptions<T>) {
      const blocked = guard();
      if (blocked && !blocked.ok) return fail(blocked.error.kind, blocked.error.message);
      const rows = (db.tables[table] as PersistenceRows[T][])
        .filter((row) => (row as { user_id: string }).user_id === uid)
        .filter((row) =>
          Object.entries(filter).every(([column, value]) =>
            value === undefined ? true : (row as unknown as Record<string, unknown>)[column] === value,
          ),
        );
      if (options?.orderBy) {
        const column = options.orderBy;
        const direction = options.ascending === false ? -1 : 1;
        rows.sort((a, b) => String(a[column]).localeCompare(String(b[column])) * direction);
      }
      return ok(clone(rows));
    },

    async insertIfAbsent<T extends PersistenceTable>(table: T, row: InsertRow<T>) {
      const blocked = guard();
      if (blocked && !blocked.ok) return fail(blocked.error.kind, blocked.error.message);
      if ((row as { user_id: string }).user_id !== uid) return fail('forbidden', 'postgrest:42501');
      const timestamp = row.created_at ?? nowIso();
      const full = {
        ...clone(row),
        created_at: timestamp,
        ...(table === 'analysis_runs' ? {} : { updated_at: timestamp, revision: 1 }),
      } as unknown as PersistenceRows[T];
      const list = db.tables[table] as PersistenceRows[T][];
      const key = keyOf(table, full);
      /* ON CONFLICT DO NOTHING — 다른 사용자의 행이어도 내용은 드러나지 않는다 */
      if (list.some((existing) => keyOf(table, existing) === key)) return ok({ inserted: false });
      const checked = checkRow(db, table, full);
      if (!checked.ok) return fail(checked.error.kind, checked.error.message);
      list.push(full);
      return ok({ inserted: true });
    },

    async updateAtRevision(table, key, expectedRevision, patch) {
      const blocked = guard();
      if (blocked && !blocked.ok) return fail(blocked.error.kind, blocked.error.message);
      const list = db.tables[table] as Array<PersistenceRows[typeof table]>;
      const index = list.findIndex(
        (row) => keyOf(table, row) === key && row.user_id === uid && row.revision === expectedRevision,
      );
      if (index < 0) return ok(null);
      const current = list[index]!;
      const next = {
        ...current,
        ...clone(patch),
        user_id: current.user_id,
        revision: expectedRevision + 1,
        updated_at: nowIso(),
      } as PersistenceRows[typeof table];
      const checked = checkRow(db, table, next);
      if (!checked.ok) return fail(checked.error.kind, checked.error.message);
      list[index] = next;
      return ok(clone(next));
    },

    async remove(table, key) {
      const blocked = guard();
      if (blocked && !blocked.ok) return fail(blocked.error.kind, blocked.error.message);
      const list = db.tables[table] as PersistenceRows[typeof table][];
      const index = list.findIndex((row) => keyOf(table, row) === key && (row as { user_id: string }).user_id === uid);
      if (index < 0) return ok({ removed: false });
      list.splice(index, 1);
      if (table === 'relationship_targets') {
        /* ON DELETE CASCADE */
        db.tables.relationship_events = db.tables.relationship_events.filter((row) => row.target_id !== key);
        db.tables.analysis_runs = db.tables.analysis_runs.filter((row) => row.target_id !== key);
      }
      return ok({ removed: true });
    },

    async attemptRawUpdate(table, key, patch) {
      const blocked = guard();
      if (blocked && !blocked.ok) return fail(blocked.error.kind, blocked.error.message);
      if (table === 'analysis_runs') return fail('forbidden', 'analysis_run_immutable');
      const list = db.tables[table] as unknown as Array<Record<string, unknown>>;
      let updated = 0;
      list.forEach((row, index) => {
        if (String(row[PRIMARY_KEY[table]]) === key && row.user_id === uid) {
          list[index] = { ...row, ...patch, user_id: row.user_id };
          updated += 1;
        }
      });
      return ok({ updated });
    },
  };
}
