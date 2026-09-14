import type {
  BirthProfile,
  ConversationQuestionId,
  CurrentRelationshipEvidence,
  DeclaredPreference,
  MbtiType,
  RelationshipEvent,
  RelationshipExperience,
  RelationshipStatus,
  TargetProfile,
} from '@/types';

/**
 * v1.47 — **앱 도메인** 영속 타입
 *
 * DB row(`lib/supabase/types.ts`)와 섞지 않는다. JSONB는 mapper에서 끝나고, 앱은 여기 있는
 * 이름 붙은 타입만 본다.
 */

export const PROFILE_SCHEMA_VERSION = 1;
export const TARGET_SCHEMA_VERSION = 1;
/** analysis_runs.app_version — 어떤 앱 버전이 남긴 '당시 결과'인지 */
export const PERSISTENCE_APP_VERSION = 'v1.47-foundation';

/** 계정에 저장하는 **나** — 사진·사진 관찰·AI 캐시는 넣지 않는다 */
export interface SelfProfileData {
  status: RelationshipStatus | null;
  declared: DeclaredPreference;
  experience: RelationshipExperience;
  mbti: MbtiType | null;
  birthProfile: BirthProfile;
}

export interface CloudProfile {
  userId: string;
  data: SelfProfileData;
  revision: number;
  updatedAt: string;
}

/**
 * 상대 한 명의 맥락. **사건은 여기 없다** — relationship_events 행으로 따로 저장한다.
 *
 * ⚠️ 상대 정보는 **사용자가 입력한 상대 정보**다. 상대가 직접 확인한 사실이 아니다.
 */
export interface TargetContextData {
  profile: Omit<TargetProfile, 'events'>;
  currentRelationship: CurrentRelationshipEvidence;
  savedQuestions: ConversationQuestionId[];
}

export interface CloudTarget {
  id: string;
  /** 선택 별칭. 실명을 요구하지 않는다 */
  label: string | null;
  relationStatus: RelationshipStatus | null;
  data: TargetContextData;
  revision: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CloudEvent {
  id: string;
  targetId: string;
  /** `event.id === id` — 클라우드에서 불러온 사건은 클라우드 id를 로컬 id로 쓴다 */
  event: RelationshipEvent;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export type AnalysisRunType = 'mirror_history' | 'deep_report';

/** '당시 결과'. 만든 뒤 수정하지 않는다 */
export interface AnalysisRun {
  id: string;
  targetId: string | null;
  type: AnalysisRunType;
  snapshot: Record<string, unknown>;
  sourceFingerprint: string | null;
  appVersion: string | null;
  modelMeta: Record<string, unknown> | null;
  createdAt: string;
}

export interface SavedRelationshipSummary {
  id: string;
  label: string | null;
  relationStatus: RelationshipStatus | null;
  lastAnalysisAt: string | null;
  archived: boolean;
}

export type PersistenceErrorKind =
  | 'not_configured'
  | 'offline'
  | 'unauthorized'
  | 'forbidden'
  | 'conflict'
  | 'not_found'
  | 'invalid'
  /** Storage Capacity Guard — 크기 · 사진 · 원문 복제 때문에 cloud write를 보내지 않았다(로컬은 그대로) */
  | 'payload_rejected'
  | 'unknown';

export type CloudPayloadIssueReason =
  | 'binary_field'
  | 'binary_value'
  | 'data_url'
  | 'blob_url'
  | 'base64_like'
  | 'forbidden_key'
  | 'nested_events'
  | 'string_too_large'
  | 'text_too_long'
  | 'array_too_large'
  | 'too_deep'
  | 'row_too_large';

/** 어떤 칸이 왜 거부됐는지. **값은 담지 않는다** */
export interface CloudPayloadIssue {
  path: string;
  reason: CloudPayloadIssueReason;
}

export interface PersistenceError {
  kind: PersistenceErrorKind;
  message: string;
  issues?: CloudPayloadIssue[];
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: PersistenceError };

/**
 * 수정 결과. **`conflict`는 조용히 덮어쓰지 않았다는 뜻이다** — 화면은
 * `SYNC_CONFLICT_COPY`로 사용자에게 최신 정보를 불러오게 한다.
 */
export type SaveResult<T> =
  | { status: 'saved'; value: T }
  | { status: 'conflict'; remote: T | null }
  | { status: 'not_found' }
  | { status: 'failed'; error: PersistenceError };

export const SYNC_CONFLICT_COPY = {
  message: '다른 곳에서 정보가 바뀌었어.',
  action: '최신 정보 불러오기',
} as const;

export const MIGRATION_CONSENT_COPY = {
  question: '이 기기에 입력한 정보를 계정에 저장할까?',
  detail: '내 답변, 지금 상대 정보와 적어둔 장면, 저장한 관찰 기록을 계정에 올려. 사진은 올리지 않아.',
  confirm: '계정에 저장하기',
  later: '나중에',
} as const;

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T = never>(
  kind: PersistenceErrorKind,
  message: string,
  issues?: CloudPayloadIssue[],
): Result<T> {
  return { ok: false, error: issues ? { kind, message, issues } : { kind, message } };
}
