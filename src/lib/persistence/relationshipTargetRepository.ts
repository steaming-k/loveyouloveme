import type { RelationshipStatus } from '@/types';

import type { PersistenceGateway } from './gateway';
import { newUuid } from './ids';
import { sanitizeLabel, targetFromRow, targetRowOf } from './mappers';
import { updateWithRevision } from './revision';
import {
  fail,
  ok,
  TARGET_SCHEMA_VERSION,
  type CloudTarget,
  type Result,
  type SavedRelationshipSummary,
  type SaveResult,
  type TargetContextData,
} from './types';

/**
 * v1.47 — 저장된 관계(상대). **새 사람은 새 행이다** — 기존 상대를 덮어쓰지 않는다.
 * 보관은 `archive`(archived_at), 삭제는 `remove`(사건·분석 CASCADE).
 */
export function createRelationshipTargetRepository(gateway: PersistenceGateway) {
  async function get(id: string): Promise<Result<CloudTarget | null>> {
    const rows = await gateway.select('relationship_targets', { id });
    if (!rows.ok) return rows;
    const [row] = rows.value;
    return ok(row ? targetFromRow(row) : null);
  }

  async function list(options: { includeArchived?: boolean } = {}): Promise<Result<CloudTarget[]>> {
    const uid = await gateway.currentUserId();
    if (!uid.ok) return uid;
    const rows = await gateway.select(
      'relationship_targets',
      { user_id: uid.value },
      { orderBy: 'updated_at', ascending: false },
    );
    if (!rows.ok) return rows;
    const targets = rows.value.map(targetFromRow);
    return ok(options.includeArchived ? targets : targets.filter((target) => target.archivedAt === null));
  }

  return {
    get,
    list,

    async createIfAbsent(input: {
      id?: string;
      label: string | null;
      relationStatus: RelationshipStatus | null;
      data: TargetContextData;
    }): Promise<Result<{ created: boolean; target: CloudTarget }>> {
      const uid = await gateway.currentUserId();
      if (!uid.ok) return uid;
      const id = input.id ?? newUuid();
      const inserted = await gateway.insertIfAbsent(
        'relationship_targets',
        targetRowOf(uid.value, { id, label: input.label, relationStatus: input.relationStatus, data: input.data }),
      );
      if (!inserted.ok) return inserted;
      const current = await get(id);
      if (!current.ok) return current;
      /* 다른 사용자의 id와 겹치면 RLS 때문에 보이지 않는다 — 우리 행이 아니다 */
      if (!current.value) return fail('conflict', 'target_id_unavailable');
      return ok({ created: inserted.value.inserted, target: current.value });
    },

    async update(
      id: string,
      patch: { label?: string | null; relationStatus?: RelationshipStatus | null; data?: TargetContextData },
      expectedRevision: number,
    ): Promise<SaveResult<CloudTarget>> {
      return updateWithRevision(
        gateway,
        'relationship_targets',
        id,
        expectedRevision,
        {
          ...(patch.label !== undefined ? { label: sanitizeLabel(patch.label) } : {}),
          ...(patch.relationStatus !== undefined ? { relation_status: patch.relationStatus } : {}),
          ...(patch.data !== undefined
            ? { target_json: JSON.parse(JSON.stringify(patch.data)), schema_version: TARGET_SCHEMA_VERSION }
            : {}),
        },
        targetFromRow,
      );
    },

    async archive(id: string, expectedRevision: number, at = new Date().toISOString()): Promise<SaveResult<CloudTarget>> {
      return updateWithRevision(gateway, 'relationship_targets', id, expectedRevision, { archived_at: at }, targetFromRow);
    },

    async unarchive(id: string, expectedRevision: number): Promise<SaveResult<CloudTarget>> {
      return updateWithRevision(gateway, 'relationship_targets', id, expectedRevision, { archived_at: null }, targetFromRow);
    },

    async remove(id: string): Promise<Result<{ removed: boolean }>> {
      return gateway.remove('relationship_targets', id);
    },

    /** 저장된 관계 목록 — 별칭 · 관계 상태 · 마지막 분석 시각 */
    async listSummaries(options: { includeArchived?: boolean } = {}): Promise<Result<SavedRelationshipSummary[]>> {
      const targets = await list(options);
      if (!targets.ok) return targets;
      const uid = await gateway.currentUserId();
      if (!uid.ok) return uid;
      const runs = await gateway.select('analysis_runs', { user_id: uid.value });
      if (!runs.ok) return runs;
      const lastByTarget = new Map<string, string>();
      for (const run of runs.value) {
        if (!run.target_id) continue;
        const previous = lastByTarget.get(run.target_id);
        if (!previous || run.created_at > previous) lastByTarget.set(run.target_id, run.created_at);
      }
      return ok(
        targets.value.map((target) => ({
          id: target.id,
          label: target.label,
          relationStatus: target.relationStatus,
          lastAnalysisAt: lastByTarget.get(target.id) ?? null,
          archived: target.archivedAt !== null,
        })),
      );
    },
  };
}

export type RelationshipTargetRepository = ReturnType<typeof createRelationshipTargetRepository>;
