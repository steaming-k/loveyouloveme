/**
 * v1.47 — DB **row** 타입 (`supabase/migrations/20260914000000_v147_persistence_foundation.sql`과 1:1)
 *
 * ⚠️ 이 타입은 `lib/persistence`의 gateway · mapper 밖으로 나가지 않는다. 앱 도메인은
 *    `lib/persistence/types.ts`의 타입만 본다(JSONB가 앱 전체에 퍼지지 않게).
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface UserProfileRow {
  user_id: string;
  profile_json: Json;
  schema_version: number;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface RelationshipTargetRow {
  id: string;
  user_id: string;
  label: string | null;
  relation_status: string | null;
  target_json: Json;
  schema_version: number;
  revision: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RelationshipEventRow {
  id: string;
  user_id: string;
  target_id: string;
  type: string;
  description: string;
  my_reaction: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface AnalysisRunRow {
  id: string;
  user_id: string;
  target_id: string | null;
  analysis_type: 'mirror_history' | 'deep_report';
  result_snapshot: Json;
  source_fingerprint: string | null;
  app_version: string | null;
  /* 20260915000000_v147_analysis_run_policy.sql — model_meta(jsonb)를 대체한다 */
  prompt_version: string | null;
  model: string | null;
  /** sha256 hex · UNIQUE(user_id, idempotency_key). History처럼 id가 결정론인 행은 null */
  idempotency_key: string | null;
  created_at: string;
}

export interface PersistenceRows {
  user_profiles: UserProfileRow;
  relationship_targets: RelationshipTargetRow;
  relationship_events: RelationshipEventRow;
  analysis_runs: AnalysisRunRow;
}

export type PersistenceTable = keyof PersistenceRows;

/** 각 테이블의 기본 키 컬럼 */
export const PRIMARY_KEY: Readonly<Record<PersistenceTable, string>> = {
  user_profiles: 'user_id',
  relationship_targets: 'id',
  relationship_events: 'id',
  analysis_runs: 'id',
};

/** revision 컬럼이 있는(= 수정 가능한) 테이블 */
export type RevisionedTable = Exclude<PersistenceTable, 'analysis_runs'>;
