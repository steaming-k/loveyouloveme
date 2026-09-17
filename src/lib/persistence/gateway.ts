import type { PersistenceRows, PersistenceTable, RevisionedTable } from '@/lib/supabase/types';

import type { Result } from './types';

/**
 * v1.47 — 저장소 **포트**
 *
 * repository는 이 인터페이스만 안다. 구현은 둘이다:
 *
 * ```
 * supabaseGateway   실제 Supabase (사용자 세션 + RLS)
 * memoryGateway     DB 규칙(RLS · FK · revision · 불변성)을 그대로 흉내 내는 메모리 구현
 *                   — Supabase 없이 fixture가 격리·멱등·충돌을 검증한다
 * ```
 *
 * ⚠️ UI는 gateway도 직접 부르지 않는다. repository → provider → 화면 순서다.
 */

export type InsertRow<T extends PersistenceTable> = Omit<
  PersistenceRows[T],
  'created_at' | 'updated_at' | 'revision'
> & { created_at?: string };

export interface SelectOptions<T extends PersistenceTable> {
  orderBy?: keyof PersistenceRows[T] & string;
  ascending?: boolean;
}

export interface PersistenceGateway {
  /** 로그인한 사용자 id. 세션이 없으면 `unauthorized` */
  currentUserId(): Promise<Result<string>>;
  /** 동등 조건만 지원한다. `null`은 IS NULL */
  select<T extends PersistenceTable>(
    table: T,
    filter: Partial<PersistenceRows[T]>,
    options?: SelectOptions<T>,
  ): Promise<Result<PersistenceRows[T][]>>;
  /** 기본 키가 이미 있으면 **아무것도 바꾸지 않는다**(ON CONFLICT DO NOTHING) */
  insertIfAbsent<T extends PersistenceTable>(
    table: T,
    row: InsertRow<T>,
  ): Promise<Result<{ inserted: boolean }>>;
  /**
   * `revision === expectedRevision`일 때만 patch를 적용하고 revision을 +1 한다.
   * 조건이 안 맞으면(0행) `value: null` — **덮어쓰지 않는다.**
   */
  updateAtRevision<T extends RevisionedTable>(
    table: T,
    key: string,
    expectedRevision: number,
    patch: Partial<Omit<PersistenceRows[T], 'revision' | 'user_id' | 'created_at' | 'updated_at'>>,
  ): Promise<Result<PersistenceRows[T] | null>>;
  remove<T extends PersistenceTable>(table: T, key: string): Promise<Result<{ removed: boolean }>>;
}
