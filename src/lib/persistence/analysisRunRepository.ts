import type { PersistenceGateway } from './gateway';
import { runFromRow, runRowOf, sameContent } from './mappers';
import { validateSnapshot } from './snapshotGuard';
import { fail, ok, type AnalysisRun, type AnalysisRunType, type Result } from './types';

/**
 * v1.47 — 분석 결과 스냅샷. **'당시 결과'는 수정하지 않는다.**
 *
 * ```
 * 새 실행          새 id → 새 행
 * 같은 id 재시도   기존 행 그대로(created:false). 내용이 달라도 덮어쓰지 않고 differs:true로 알린다
 * update           없다(DB에도 UPDATE 정책 없음 + 트리거)
 * ```
 */
export function createAnalysisRunRepository(gateway: PersistenceGateway) {
  async function get(id: string): Promise<Result<AnalysisRun | null>> {
    const rows = await gateway.select('analysis_runs', { id });
    if (!rows.ok) return rows;
    const [row] = rows.value;
    return ok(row ? runFromRow(row) : null);
  }

  return {
    get,

    async record(
      input: Omit<AnalysisRun, 'appVersion' | 'createdAt'> & { createdAt?: string },
    ): Promise<Result<{ created: boolean; differs: boolean; run: AnalysisRun }>> {
      const safe = validateSnapshot(input.snapshot);
      if (!safe.ok) return safe;
      const uid = await gateway.currentUserId();
      if (!uid.ok) return uid;
      const inserted = await gateway.insertIfAbsent('analysis_runs', runRowOf(uid.value, input));
      if (!inserted.ok) return inserted;
      const stored = await get(input.id);
      if (!stored.ok) return stored;
      if (!stored.value) return fail('conflict', 'analysis_run_id_unavailable');
      return ok({
        created: inserted.value.inserted,
        differs: !sameContent(stored.value.snapshot, JSON.parse(JSON.stringify(input.snapshot))),
        run: stored.value,
      });
    },

    async list(filter: { targetId?: string | null; type?: AnalysisRunType } = {}): Promise<Result<AnalysisRun[]>> {
      const uid = await gateway.currentUserId();
      if (!uid.ok) return uid;
      const rows = await gateway.select(
        'analysis_runs',
        {
          user_id: uid.value,
          ...(filter.targetId !== undefined ? { target_id: filter.targetId } : {}),
          ...(filter.type ? { analysis_type: filter.type } : {}),
        },
        { orderBy: 'created_at', ascending: false },
      );
      if (!rows.ok) return rows;
      return ok(rows.value.map(runFromRow));
    },

    async latestForTarget(targetId: string, type?: AnalysisRunType): Promise<Result<AnalysisRun | null>> {
      const rows = await gateway.select(
        'analysis_runs',
        { target_id: targetId, ...(type ? { analysis_type: type } : {}) },
        { orderBy: 'created_at', ascending: false },
      );
      if (!rows.ok) return rows;
      const [row] = rows.value;
      return ok(row ? runFromRow(row) : null);
    },

    async remove(id: string): Promise<Result<{ removed: boolean }>> {
      return gateway.remove('analysis_runs', id);
    },
  };
}

export type AnalysisRunRepository = ReturnType<typeof createAnalysisRunRepository>;
