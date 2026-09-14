import type { SupabaseClient } from '@supabase/supabase-js';

import { PRIMARY_KEY, type PersistenceRows, type PersistenceTable } from '@/lib/supabase/types';

import { rejectCloudPayload } from './cloudWriteBudget';
import type { PersistenceGateway } from './gateway';
import { fail, ok, type PersistenceErrorKind, type Result } from './types';

/**
 * v1.47 — Supabase 구현. 사용자 세션으로만 부른다 — RLS가 소유권을 강제한다.
 *
 * ⚠️ 에러 메시지에 행 내용을 싣지 않는다. PostgREST 메시지는 컬럼명 수준이고, 여기서도
 *    값(사건 본문 등)을 붙이지 않는다.
 */

interface PostgrestLikeError {
  code?: string;
  message?: string;
}

function kindOfPostgrest(error: PostgrestLikeError): PersistenceErrorKind {
  const code = error.code ?? '';
  const message = error.message ?? '';
  if (/fetch|network|Failed to fetch|ECONNREFUSED|ENOTFOUND/i.test(message) && !code) return 'offline';
  if (code === '42501') return 'forbidden';
  if (code === 'PGRST301' || code === 'PGRST302' || /JWT|not authenticated/i.test(message)) return 'unauthorized';
  if (code === '40001' || code === '23505') return 'conflict';
  if (code === '23503' || code === '23514' || code === '22P02' || code === '23502') return 'invalid';
  return 'unknown';
}

function fromError<T>(error: PostgrestLikeError): Result<T> {
  return fail(kindOfPostgrest(error), error.code ? `postgrest:${error.code}` : 'postgrest:error');
}

function thrown<T>(cause: unknown): Result<T> {
  const message = cause instanceof Error ? cause.name : 'error';
  return fail('offline', `request_failed:${message}`);
}

export function createSupabaseGateway(client: SupabaseClient): PersistenceGateway {
  return {
    async currentUserId() {
      try {
        const { data, error } = await client.auth.getUser();
        if (error || !data.user) return fail('unauthorized', 'no_session');
        return ok(data.user.id);
      } catch (cause) {
        return thrown(cause);
      }
    },

    async select<T extends PersistenceTable>(
      table: T,
      filter: Partial<PersistenceRows[T]>,
      options?: { orderBy?: string; ascending?: boolean },
    ) {
      try {
        let query = client.from(table).select('*');
        for (const [column, value] of Object.entries(filter)) {
          if (value === undefined) continue;
          query = value === null ? query.is(column, null) : query.eq(column, value as string | number | boolean);
        }
        const ordered = options?.orderBy
          ? query.order(options.orderBy, { ascending: options.ascending ?? true })
          : query;
        const { data, error } = await ordered;
        if (error) return fromError<PersistenceRows[T][]>(error);
        return ok((data ?? []) as PersistenceRows[T][]);
      } catch (cause) {
        return thrown(cause);
      }
    },

    async insertIfAbsent(table, row) {
      /* Storage Capacity Guard — 요청을 만들기 전에 멈춘다. 기존 행 · 로컬 데이터는 그대로다 */
      const rejected = rejectCloudPayload(table, row);
      if (rejected) return rejected;
      try {
        const key: string = PRIMARY_KEY[table];
        const { data, error } = await client
          .from(table)
          .upsert(row, { onConflict: key, ignoreDuplicates: true })
          .select(key);
        if (error) return fromError(error);
        return ok({ inserted: (data ?? []).length > 0 });
      } catch (cause) {
        return thrown(cause);
      }
    },

    async updateAtRevision(table, key, expectedRevision, patch) {
      const rejected = rejectCloudPayload(table, patch);
      if (rejected) return rejected;
      try {
        const { data, error } = await client
          .from(table)
          .update({ ...patch, revision: expectedRevision + 1 })
          .eq(PRIMARY_KEY[table] as string, key)
          .eq('revision', expectedRevision)
          .select('*');
        if (error) return fromError(error);
        const rows = (data ?? []) as PersistenceRows[typeof table][];
        return ok(rows[0] ?? null);
      } catch (cause) {
        return thrown(cause);
      }
    },

    async remove(table, key) {
      try {
        const pk: string = PRIMARY_KEY[table];
        const { data, error } = await client.from(table).delete().eq(pk, key).select(pk);
        if (error) return fromError(error);
        return ok({ removed: (data ?? []).length > 0 });
      } catch (cause) {
        return thrown(cause);
      }
    },
  };
}
