import type { PersistenceGateway } from './gateway';
import { analysisIdempotencyKeyOf, newUuid } from './ids';
import { runFromRow, runRowOf, sameContent } from './mappers';
import { validateSnapshot } from './snapshotGuard';
import { fail, ok, type AnalysisRun, type AnalysisRunType, type GeneratedAnalysisRun, type Result } from './types';

/**
 * v1.47 — 분석 결과 스냅샷. **'당시 결과'는 수정하지 않는다.**
 *
 * ```
 * recordGenerated   새 분석 결과 — 새 random UUID.
 *                   같은 generationRequestId 재시도 → 같은 idempotency key → 기존 행(created:false)
 *                   다시 분석(새 generationRequestId) → 새 행
 * record            id가 이미 정해진 스냅샷(History migration). 같은 id면 기존 행 그대로, 내용이 다르면 differs:true
 * update            없다(DB에도 UPDATE 정책 없음 + 트리거)
 * ```
 *
 * ⚠️ idempotency key는 sha256 해시다 — 요청 id · 지문 원문이 행에 남지 않는다.
 */
type RecordInput = Omit<AnalysisRun, 'appVersion' | 'createdAt' | 'promptVersion' | 'model' | 'idempotencyKey'> &
  Partial<Pick<AnalysisRun, 'promptVersion' | 'model' | 'idempotencyKey'>> & {
    createdAt?: string;
    /** Storage Capacity Guard §3 — 스냅샷에 다시 들어가면 안 되는 원문(사건 본문 · 반응) */
    forbiddenTexts?: readonly string[];
  };

export function createAnalysisRunRepository(gateway: PersistenceGateway) {
  async function get(id: string): Promise<Result<AnalysisRun | null>> {
    const rows = await gateway.select('analysis_runs', { id });
    if (!rows.ok) return rows;
    const [row] = rows.value;
    return ok(row ? runFromRow(row) : null);
  }

  async function byIdempotencyKey(key: string): Promise<Result<AnalysisRun | null>> {
    const rows = await gateway.select('analysis_runs', { idempotency_key: key });
    if (!rows.ok) return rows;
    const [row] = rows.value;
    return ok(row ? runFromRow(row) : null);
  }

  return {
    get,

    async record(input: RecordInput): Promise<Result<{ created: boolean; differs: boolean; run: AnalysisRun }>> {
      const safe = validateSnapshot(input.snapshot, { forbiddenTexts: input.forbiddenTexts });
      if (!safe.ok) return safe;
      const uid = await gateway.currentUserId();
      if (!uid.ok) return uid;
      const inserted = await gateway.insertIfAbsent(
        'analysis_runs',
        runRowOf(uid.value, {
          id: input.id,
          targetId: input.targetId,
          type: input.type,
          snapshot: input.snapshot,
          sourceFingerprint: input.sourceFingerprint,
          promptVersion: input.promptVersion ?? null,
          model: input.model ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          createdAt: input.createdAt,
        }),
      );
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

    async recordGenerated(
      input: GeneratedAnalysisRun & { forbiddenTexts?: readonly string[] },
    ): Promise<Result<{ created: boolean; run: AnalysisRun }>> {
      if (!input.generationRequestId.trim()) return fail('invalid', 'generation_request_id_required');
      const safe = validateSnapshot(input.snapshot, { forbiddenTexts: input.forbiddenTexts });
      if (!safe.ok) return safe;
      const uid = await gateway.currentUserId();
      if (!uid.ok) return uid;
      const idempotencyKey = await analysisIdempotencyKeyOf({
        userId: uid.value,
        targetId: input.targetId,
        analysisType: input.type,
        sourceFingerprint: input.sourceFingerprint,
        generationRequestId: input.generationRequestId,
      });

      /* 같은 생성 결과의 retry — 새 행을 만들지 않는다 */
      const existing = await byIdempotencyKey(idempotencyKey);
      if (!existing.ok) return existing;
      if (existing.value) return ok({ created: false, run: existing.value });

      const id = newUuid();
      const inserted = await gateway.insertIfAbsent(
        'analysis_runs',
        runRowOf(uid.value, {
          id,
          targetId: input.targetId,
          type: input.type,
          snapshot: input.snapshot,
          sourceFingerprint: input.sourceFingerprint,
          promptVersion: input.promptVersion,
          model: input.model,
          idempotencyKey,
        }),
      );
      if (!inserted.ok) {
        /* 동시에 같은 retry가 먼저 들어갔다(UNIQUE 23505) — 그 행을 돌려준다 */
        if (inserted.error.kind === 'conflict') {
          const raced = await byIdempotencyKey(idempotencyKey);
          if (raced.ok && raced.value) return ok({ created: false, run: raced.value });
        }
        return inserted;
      }
      const stored = await get(id);
      if (!stored.ok) return stored;
      if (!stored.value) return fail('conflict', 'analysis_run_id_unavailable');
      return ok({ created: inserted.value.inserted, run: stored.value });
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
