import type { PersistenceGateway } from './gateway';
import { profileFromRow, profileRowOf } from './mappers';
import { updateWithRevision } from './revision';
import { fail, ok, PROFILE_SCHEMA_VERSION, type CloudProfile, type Result, type SaveResult, type SelfProfileData } from './types';

/** v1.47 — 나(self profile). 사용자당 한 행 */
export function createProfileRepository(gateway: PersistenceGateway) {
  async function get(): Promise<Result<CloudProfile | null>> {
    const uid = await gateway.currentUserId();
    if (!uid.ok) return uid;
    const rows = await gateway.select('user_profiles', { user_id: uid.value });
    if (!rows.ok) return rows;
    const [row] = rows.value;
    return ok(row ? profileFromRow(row) : null);
  }

  return {
    get,

    /** 없을 때만 만든다. 이미 있으면 **그대로 두고** 기존 값을 돌려준다 */
    async createIfAbsent(data: SelfProfileData): Promise<Result<{ created: boolean; profile: CloudProfile }>> {
      const uid = await gateway.currentUserId();
      if (!uid.ok) return uid;
      const inserted = await gateway.insertIfAbsent('user_profiles', profileRowOf(uid.value, data));
      if (!inserted.ok) return inserted;
      const current = await get();
      if (!current.ok) return current;
      if (!current.value) return fail('not_found', 'profile_missing_after_insert');
      return ok({ created: inserted.value.inserted, profile: current.value });
    },

    async update(data: SelfProfileData, expectedRevision: number): Promise<SaveResult<CloudProfile>> {
      const uid = await gateway.currentUserId();
      if (!uid.ok) return { status: 'failed', error: uid.error };
      const row = profileRowOf(uid.value, data);
      return updateWithRevision(
        gateway,
        'user_profiles',
        uid.value,
        expectedRevision,
        { profile_json: row.profile_json, schema_version: PROFILE_SCHEMA_VERSION },
        profileFromRow,
      );
    },

    async remove(): Promise<Result<{ removed: boolean }>> {
      const uid = await gateway.currentUserId();
      if (!uid.ok) return uid;
      return gateway.remove('user_profiles', uid.value);
    },
  };
}

export type ProfileRepository = ReturnType<typeof createProfileRepository>;
