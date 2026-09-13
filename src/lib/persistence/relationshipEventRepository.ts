import type { RelationshipEventType } from '@/types';

import type { PersistenceGateway } from './gateway';
import { newUuid } from './ids';
import { eventFromRow, eventRowOf } from './mappers';
import { updateWithRevision } from './revision';
import { fail, ok, type CloudEvent, type Result, type SaveResult } from './types';

/**
 * v1.47 — 관계 사건. 한 사건 = 한 행이고 **반드시 한 상대에 속한다**(복합 FK).
 *
 * ⚠️ 사건 본문은 로그 · analytics · 에러 메시지로 내보내지 않는다.
 */
export function createRelationshipEventRepository(gateway: PersistenceGateway) {
  return {
    async listByTarget(targetId: string): Promise<Result<CloudEvent[]>> {
      const rows = await gateway.select(
        'relationship_events',
        { target_id: targetId },
        { orderBy: 'created_at', ascending: true },
      );
      if (!rows.ok) return rows;
      return ok(rows.value.map(eventFromRow).filter((event): event is CloudEvent => event !== null));
    },

    async createIfAbsent(
      targetId: string,
      event: { type: RelationshipEventType; description: string; myReaction?: string },
      options: { id?: string; createdAt?: string } = {},
    ): Promise<Result<{ created: boolean; event: CloudEvent }>> {
      if (!event.description.trim()) return fail('invalid', 'event_description_empty');
      const uid = await gateway.currentUserId();
      if (!uid.ok) return uid;
      const id = options.id ?? newUuid();
      const inserted = await gateway.insertIfAbsent(
        'relationship_events',
        eventRowOf(uid.value, targetId, id, event, options.createdAt),
      );
      if (!inserted.ok) return inserted;
      const rows = await gateway.select('relationship_events', { id });
      if (!rows.ok) return rows;
      const [row] = rows.value;
      const stored = row ? eventFromRow(row) : null;
      if (!stored) return fail('conflict', 'event_id_unavailable');
      if (stored.targetId !== targetId) return fail('conflict', 'event_belongs_to_other_target');
      return ok({ created: inserted.value.inserted, event: stored });
    },

    async update(
      id: string,
      patch: { type?: RelationshipEventType; description?: string; myReaction?: string | null },
      expectedRevision: number,
    ): Promise<SaveResult<CloudEvent>> {
      if (patch.description !== undefined && !patch.description.trim()) {
        return { status: 'failed', error: { kind: 'invalid', message: 'event_description_empty' } };
      }
      return updateWithRevision(
        gateway,
        'relationship_events',
        id,
        expectedRevision,
        {
          ...(patch.type !== undefined ? { type: patch.type } : {}),
          ...(patch.description !== undefined ? { description: patch.description.trim() } : {}),
          ...(patch.myReaction !== undefined ? { my_reaction: patch.myReaction?.trim() || null } : {}),
        },
        (row) => {
          const event = eventFromRow(row);
          if (!event) throw new Error('corrupted_event_row');
          return event;
        },
      );
    },

    async remove(id: string): Promise<Result<{ removed: boolean }>> {
      return gateway.remove('relationship_events', id);
    },
  };
}

export type RelationshipEventRepository = ReturnType<typeof createRelationshipEventRepository>;
