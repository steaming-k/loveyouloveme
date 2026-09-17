import type { PersistenceRows, RevisionedTable } from '@/lib/supabase/types';
import { PRIMARY_KEY } from '@/lib/supabase/types';

import type { PersistenceGateway } from './gateway';
import type { SaveResult } from './types';

/**
 * v1.47 — revision 기반 수정 (조용한 last-write-wins 금지)
 *
 * ```
 * 조건 일치        saved
 * 0행 + 행 있음    conflict — 원격 최신값을 함께 돌려준다(덮어쓰지 않음)
 * 0행 + 행 없음    not_found
 * 전송 실패        failed
 * ```
 */
export async function updateWithRevision<T extends RevisionedTable, D>(
  gateway: PersistenceGateway,
  table: T,
  key: string,
  expectedRevision: number,
  patch: Parameters<PersistenceGateway['updateAtRevision']>[3],
  fromRow: (row: PersistenceRows[T]) => D,
): Promise<SaveResult<D>> {
  const updated = await gateway.updateAtRevision(table, key, expectedRevision, patch);
  if (!updated.ok && updated.error.kind !== 'conflict') return { status: 'failed', error: updated.error };
  if (updated.ok && updated.value) return { status: 'saved', value: fromRow(updated.value as PersistenceRows[T]) };

  const filter = { [PRIMARY_KEY[table]]: key } as Partial<PersistenceRows[T]>;
  const remote = await gateway.select(table, filter);
  if (!remote.ok) return { status: 'failed', error: remote.error };
  const [row] = remote.value;
  return row ? { status: 'conflict', remote: fromRow(row) } : { status: 'not_found' };
}
