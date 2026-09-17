import { MIRROR_AXES } from '@/data/axes';
import { createEmptyBirthProfile } from '@/lib/logic/birth';
import { sanitizeRelationshipEvents } from '@/lib/logic/relationshipEvents';
import {
  sanitizeAffection,
  sanitizeConflict,
  sanitizeCurrentSignals,
  sanitizeHardest,
  sanitizeHobby,
  sanitizePastFactors,
  sanitizeScale,
  sanitizeSelfGap,
  sanitizeStatus,
  sanitizeTargetLevel,
  sanitizeTargetRelation,
} from '@/lib/sessionSanitize';
import type {
  AnalysisRunRow,
  Json,
  RelationshipEventRow,
  RelationshipTargetRow,
  UserProfileRow,
} from '@/lib/supabase/types';
import type {
  AdaptiveAnswer,
  BirthProfile,
  ConversationQuestionId,
  MbtiType,
  RelationshipEvent,
  SessionAnswers,
  TargetInterest,
  TargetInterestCategory,
} from '@/types';

import type { InsertRow } from './gateway';
import {
  PERSISTENCE_APP_VERSION,
  PROFILE_SCHEMA_VERSION,
  TARGET_SCHEMA_VERSION,
  type AnalysisRun,
  type AnalysisRunType,
  type CloudEvent,
  type CloudProfile,
  type CloudTarget,
  type SelfProfileData,
  type TargetContextData,
} from './types';

/**
 * v1.47 — **DB row ↔ 도메인** 변환
 *
 * ⚠️ 클라우드에서 읽은 JSON도 **로컬 세션 복원과 같은 sanitize를 통과한다.** 손상되거나 조작된
 *    행이 판정 경로로 흘러가지 않게 하는 규칙(v1.44 BUG-002)은 저장소가 바뀌어도 같다.
 * ⚠️ **자르지 않는다**(Storage Capacity Guard §7). 너무 긴 값은 여기서 줄이지 않고 cloud write guard가
 *    거부한다 — 몰래 잘라 저장하면 사용자 입력이 조용히 바뀐다.
 * ⚠️ 유효한 값은 **그대로** 돌아온다 — 그래서 로컬과 클라우드에서 점수 · Mirror · Top 3 ·
 *    사건 선택이 같다(fixture PARITY).
 */

const MBTI_PATTERN = /^[EI][NS][TF][JP]$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function sanitizeMbti(value: unknown): MbtiType | null {
  return typeof value === 'string' && MBTI_PATTERN.test(value) ? (value as MbtiType) : null;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function sanitizeBirthProfile(value: unknown): BirthProfile {
  const raw = record(value);
  const base = createEmptyBirthProfile();
  const location = record(raw.location);
  const country = optionalString(location.country);
  const city = optionalString(location.city);
  const timezone = optionalString(location.timezone);
  return {
    date: typeof raw.date === 'string' && DATE_PATTERN.test(raw.date) ? raw.date : null,
    time: typeof raw.time === 'string' && TIME_PATTERN.test(raw.time) ? raw.time : null,
    timeUnknown: raw.timeUnknown === true,
    calendarType: raw.calendarType === 'lunar' ? 'lunar' : base.calendarType,
    location:
      country || city || timezone
        ? { ...(country ? { country } : {}), ...(city ? { city } : {}), ...(timezone ? { timezone } : {}) }
        : null,
  };
}

function sanitizeAdaptive(value: unknown): AdaptiveAnswer | null {
  const raw = record(value);
  const axes = new Set<string>(MIRROR_AXES.map((axis) => axis.key));
  if (typeof raw.axis !== 'string' || !axes.has(raw.axis)) return null;
  if (typeof raw.optionId !== 'string' || !raw.optionId) return null;
  return { axis: raw.axis as AdaptiveAnswer['axis'], optionId: raw.optionId };
}

function sanitizeInterests(value: unknown): TargetInterest[] {
  if (!Array.isArray(value)) return [];
  const out: TargetInterest[] = [];
  for (const item of value) {
    const raw = record(item);
    if (typeof raw.id !== 'string' || typeof raw.category !== 'string' || typeof raw.label !== 'string') continue;
    const label = raw.label.trim();
    if (!label) continue;
    out.push({ id: raw.id, category: raw.category as TargetInterestCategory, label });
  }
  return out;
}

function sanitizeSavedQuestions(value: unknown): ConversationQuestionId[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))] as ConversationQuestionId[];
}

/** 선택 별칭 — 줄바꿈 제거 · 40자. 비면 null(실명·별칭을 요구하지 않는다) */
export function sanitizeLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const label = value.replace(/\s+/g, ' ').trim();
  return label || null;
}

/* ───────────────────────────────────────────────────── 세션 → 도메인 */

export function selfProfileFromSession(answers: SessionAnswers): SelfProfileData {
  return sanitizeSelfProfile({
    status: answers.status,
    declared: answers.declared,
    experience: answers.experience,
    mbti: answers.mbti,
    birthProfile: answers.birthProfile,
  });
}

export function targetContextFromSession(answers: SessionAnswers): TargetContextData {
  return sanitizeTargetContext({
    profile: answers.target,
    currentRelationship: answers.currentRelationship,
    savedQuestions: answers.savedQuestions,
  });
}

export function sanitizeSelfProfile(value: unknown): SelfProfileData {
  const raw = record(value);
  const declared = record(raw.declared);
  const experience = record(raw.experience);
  return {
    status: sanitizeStatus(raw.status),
    declared: {
      contact: sanitizeScale(declared.contact),
      conflict: sanitizeConflict(declared.conflict),
      alone: sanitizeScale(declared.alone),
      affection: sanitizeAffection(declared.affection),
      hobby: sanitizeHobby(declared.hobby),
    },
    /*
      ⚠️ **키 순서를 `RelationshipExperience` 선언 순서와 맞춘다.** parity 검사가
      `JSON.stringify` 비교라서, 같은 값이어도 순서가 다르면 '클라우드 왕복에서
      값이 달라졌다'로 잡힌다(260915 UT P1-2에서 실제로 걸렸다).
    */
    experience: {
      important: sanitizePastFactors(experience.important),
      /* 260915 UT P1-2 — v1.47 이전 저장본에는 없다. 없으면 빈 문자열이 정상값이다 */
      importantOther:
        typeof experience.importantOther === 'string' ? experience.importantOther : '',
      hardest: sanitizeHardest(experience.hardest),
      selfGap: sanitizeSelfGap(experience.selfGap),
      note: typeof experience.note === 'string' ? experience.note : '',
      skipped: experience.skipped === true,
      adaptive: sanitizeAdaptive(experience.adaptive),
    },
    mbti: sanitizeMbti(raw.mbti),
    birthProfile: sanitizeBirthProfile(raw.birthProfile),
  };
}

export function sanitizeTargetContext(value: unknown): TargetContextData {
  const raw = record(value);
  const profile = record(raw.profile);
  const current = record(raw.currentRelationship);
  return {
    profile: {
      relation: sanitizeTargetRelation(profile.relation),
      contact: sanitizeTargetLevel(profile.contact),
      conflict: sanitizeTargetLevel(profile.conflict),
      alone: sanitizeTargetLevel(profile.alone),
      affection: sanitizeTargetLevel(profile.affection),
      mbti: sanitizeMbti(profile.mbti),
      birthProfile: sanitizeBirthProfile(profile.birthProfile),
      preferences: { interests: sanitizeInterests(record(profile.preferences).interests) },
    },
    currentRelationship: {
      signals: sanitizeCurrentSignals(current.signals),
      askedAt: typeof current.askedAt === 'string' ? current.askedAt : null,
    },
    savedQuestions: sanitizeSavedQuestions(raw.savedQuestions),
  };
}

/**
 * 도메인 → 세션. **사진 · 사진 관찰 · 진행 플래그 등 로컬 전용 값은 base에서 그대로 둔다.**
 * 사건은 인자로 받은 목록만 쓴다 — 다른 상대의 사건이 섞일 경로가 없다.
 */
export function sessionWithCloudContext(
  base: SessionAnswers,
  input: { profile: SelfProfileData | null; target: TargetContextData | null; events: readonly RelationshipEvent[] },
): SessionAnswers {
  const next: SessionAnswers = { ...base };
  if (input.profile) {
    next.status = input.profile.status;
    next.declared = input.profile.declared;
    next.experience = input.profile.experience;
    next.mbti = input.profile.mbti;
    next.birthProfile = input.profile.birthProfile;
  }
  if (input.target) {
    next.target = { ...input.target.profile, events: sanitizeRelationshipEvents(input.events).events };
    next.currentRelationship = input.target.currentRelationship;
    next.savedQuestions = input.target.savedQuestions;
  }
  return next;
}

/* ───────────────────────────────────────────────────── 도메인 ↔ row */

function asJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export function profileRowOf(userId: string, data: SelfProfileData): InsertRow<'user_profiles'> {
  return { user_id: userId, profile_json: asJson(sanitizeSelfProfile(data)), schema_version: PROFILE_SCHEMA_VERSION };
}

export function profileFromRow(row: UserProfileRow): CloudProfile {
  return {
    userId: row.user_id,
    data: sanitizeSelfProfile(row.profile_json),
    revision: row.revision,
    updatedAt: row.updated_at,
  };
}

export function targetRowOf(
  userId: string,
  input: { id: string; label: string | null; relationStatus: SelfProfileData['status']; data: TargetContextData },
): InsertRow<'relationship_targets'> {
  return {
    id: input.id,
    user_id: userId,
    label: sanitizeLabel(input.label),
    relation_status: input.relationStatus,
    /* 도메인 칸만 옮긴다 — 섞여 들어온 사건 배열 · 사진 필드는 여기서 빠진다(STORAGE-04 · 09) */
    target_json: asJson(sanitizeTargetContext(input.data)),
    schema_version: TARGET_SCHEMA_VERSION,
    archived_at: null,
  };
}

export function targetFromRow(row: RelationshipTargetRow): CloudTarget {
  return {
    id: row.id,
    label: sanitizeLabel(row.label),
    relationStatus: sanitizeStatus(row.relation_status),
    data: sanitizeTargetContext(row.target_json),
    revision: row.revision,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function eventRowOf(
  userId: string,
  targetId: string,
  cloudId: string,
  event: Pick<RelationshipEvent, 'type' | 'description' | 'myReaction'>,
  createdAt?: string,
): InsertRow<'relationship_events'> {
  return {
    id: cloudId,
    user_id: userId,
    target_id: targetId,
    type: event.type,
    description: event.description.trim(),
    my_reaction: event.myReaction?.trim() ? event.myReaction.trim() : null,
    ...(createdAt ? { created_at: createdAt } : {}),
  };
}

/** 손상된 행은 `null` — 화면에 올리지 않는다(로컬 복원과 같은 규칙) */
export function eventFromRow(row: RelationshipEventRow): CloudEvent | null {
  const [event] = sanitizeRelationshipEvents([
    { id: row.id, type: row.type, description: row.description, myReaction: row.my_reaction ?? undefined },
  ]).events;
  if (!event) return null;
  return {
    id: row.id,
    targetId: row.target_id,
    event,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function runRowOf(
  userId: string,
  run: Omit<AnalysisRun, 'createdAt' | 'appVersion'> & { createdAt?: string },
): InsertRow<'analysis_runs'> {
  return {
    id: run.id,
    user_id: userId,
    target_id: run.targetId,
    analysis_type: run.type,
    result_snapshot: asJson(run.snapshot),
    source_fingerprint: run.sourceFingerprint,
    prompt_version: run.promptVersion,
    model: run.model,
    idempotency_key: run.idempotencyKey,
    app_version: PERSISTENCE_APP_VERSION,
    ...(run.createdAt ? { created_at: run.createdAt } : {}),
  };
}

export function runFromRow(row: AnalysisRunRow): AnalysisRun {
  return {
    id: row.id,
    targetId: row.target_id,
    type: row.analysis_type as AnalysisRunType,
    snapshot: record(row.result_snapshot),
    sourceFingerprint: row.source_fingerprint,
    promptVersion: row.prompt_version,
    model: row.model,
    idempotencyKey: row.idempotency_key,
    appVersion: row.app_version,
    createdAt: row.created_at,
  };
}

/** 키 순서와 무관한 비교 — '같은 내용이면 건드리지 않는다'(멱등 migration) */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sameContent(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}
