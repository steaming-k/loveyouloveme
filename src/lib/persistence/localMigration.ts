import type { RelationshipEvent, RelationshipHistoryEntry, SessionAnswers } from '@/types';

import { createAnalysisRunRepository } from './analysisRunRepository';
import { estimateUtf8Bytes } from './cloudWriteBudget';
import type { PersistenceGateway } from './gateway';
import { cloudEventIdOf, cloudTargetIdOf } from './ids';
import {
  eventRowOf,
  profileRowOf,
  runRowOf,
  sameContent,
  selfProfileFromSession,
  targetContextFromSession,
  targetRowOf,
} from './mappers';
import { createProfileRepository } from './profileRepository';
import { createRelationshipEventRepository } from './relationshipEventRepository';
import { createRelationshipTargetRepository } from './relationshipTargetRepository';
import { historyEntryRunInput } from './snapshotGuard';
import { hasTargetContext, type TargetRegistryState } from './targetRegistry';
import type {
  CloudPayloadIssue,
  PersistenceError,
  PersistenceErrorKind,
  SelfProfileData,
  TargetContextData,
} from './types';

/**
 * v1.47 — **기기 → 계정** migration
 *
 * ```
 * 동의 없으면        아무 요청도 보내지 않는다(consent_required) — 자동 silent upload 금지
 * 로컬 데이터         읽기만 한다. 지우거나 바꾸지 않는다
 * 대상               나 · 지금 상대 · 보관된 상대 · 상대별 사건 · History 스냅샷
 * 제외               사진 · 사진 관찰 결과 · AI 캐시 · analytics (필드 단위 allowlist로 옮긴다)
 * 단위               repository별 작은 write — 거대한 JSON 하나로 올리지 않는다
 * id 분리            로컬 상대 id를 cloud 소유 id로 쓰지 않는다 — (userId, localTargetId) → cloudTargetId
 *                    같은 기기를 다른 계정이 저장하면 cloud id가 다르다(cloudLinks.ts)
 * 멱등               stable id + insert-if-absent. 새로고침 · 재로그인 · 재시도해도 중복 없음
 * 이미 다른 값        덮어쓰지 않고 conflict로 보고한다
 * 너무 큰 · 사진 섞인 항목  그 항목만 거부(rejected)하고 나머지는 계속한다. 잘라서 올리지 않는다
 * 중간 실패           멈추고 partial/offline — 재시도하면 남은 것만 들어간다
 * ```
 */

export interface LocalDataSnapshot {
  answers: SessionAnswers;
  history: readonly RelationshipHistoryEntry[];
  registry: TargetRegistryState;
}

export interface PlannedTarget {
  /** 이 기기의 상대 슬롯 id(`lym.targets.v1`). cloud id가 아니다 */
  id: string;
  label: string | null;
  relationStatus: SessionAnswers['status'];
  data: TargetContextData;
  events: RelationshipEvent[];
  active: boolean;
}

export interface MigrationPlan {
  profile: SelfProfileData | null;
  targets: PlannedTarget[];
  history: RelationshipHistoryEntry[];
  excluded: readonly ('photos' | 'observedAnalysis' | 'aiCache' | 'analytics')[];
}

export const MIGRATION_EXCLUDED = ['photos', 'observedAnalysis', 'aiCache', 'analytics'] as const;

export function hasMeaningfulSelfProfile(answers: SessionAnswers): boolean {
  const { declared, experience } = answers;
  return (
    answers.status !== null ||
    Object.values(declared).some((value) => value !== null) ||
    experience.important.length > 0 ||
    experience.hardest !== null ||
    experience.selfGap !== null ||
    experience.note.trim().length > 0 ||
    experience.skipped ||
    answers.mbti !== null ||
    Boolean(answers.birthProfile.date)
  );
}

export function planLocalMigration(snapshot: LocalDataSnapshot): MigrationPlan {
  const { answers, registry } = snapshot;
  const targets: PlannedTarget[] = [];
  if (hasTargetContext(answers)) {
    targets.push({
      id: registry.activeTargetId,
      label: registry.activeLabel,
      relationStatus: answers.status,
      data: targetContextFromSession(answers),
      events: answers.target.events,
      active: true,
    });
  }
  for (const saved of registry.saved) {
    targets.push({
      id: saved.id,
      label: saved.label,
      relationStatus: saved.status,
      data: saved.context,
      events: saved.events,
      active: false,
    });
  }
  return {
    profile: hasMeaningfulSelfProfile(answers) ? selfProfileFromSession(answers) : null,
    targets,
    history: [...snapshot.history],
    excluded: MIGRATION_EXCLUDED,
  };
}

export type MigrationEntity = 'profile' | 'target' | 'event' | 'analysis_run';

export interface MigrationCounts {
  profile: number;
  targets: number;
  events: number;
  analysisRuns: number;
}

/** Storage Capacity Guard §30 — 보내려고 만든 행의 UTF-8 바이트(거부된 것 포함). 크기 회귀 감지용 */
export interface MigrationBytes extends MigrationCounts {
  total: number;
}

export type MigrationStatus =
  | 'consent_required'
  | 'nothing_to_migrate'
  | 'unauthorized'
  | 'offline'
  | 'completed'
  | 'completed_with_conflicts'
  | 'completed_with_rejections'
  | 'partial'
  | 'failed';

export interface MigrationReport {
  status: MigrationStatus;
  created: MigrationCounts;
  unchanged: MigrationCounts;
  /** 계정에 이미 **다른 값**이 있어 건드리지 않은 것 — id만 담는다(본문 없음) */
  conflicts: { entity: MigrationEntity; id: string }[];
  /** 크기 · 사진 · 원문 복제 때문에 올리지 않은 것 — 어떤 칸이 왜인지만 담는다(값 없음). 로컬엔 그대로 있다 */
  rejected: { entity: MigrationEntity; id: string; issues: CloudPayloadIssue[] }[];
  failures: { entity: MigrationEntity; id: string; kind: PersistenceErrorKind }[];
  bytes: MigrationBytes;
  /** 계정에 들어가 있는(created · unchanged) 상대의 local ↔ cloud id. 호출부가 이 사용자의 link로 남긴다 */
  links: { localTargetId: string; cloudTargetId: string }[];
}

function emptyCounts(): MigrationCounts {
  return { profile: 0, targets: 0, events: 0, analysisRuns: 0 };
}

export function emptyMigrationReport(status: MigrationStatus): MigrationReport {
  return {
    status,
    created: emptyCounts(),
    unchanged: emptyCounts(),
    conflicts: [],
    rejected: [],
    failures: [],
    bytes: { ...emptyCounts(), total: 0 },
    links: [],
  };
}

/** 이 항목의 내용 때문에 쓰지 않은 것 — 네트워크 실패와 달리 다른 항목은 계속 올린다 */
function isRejection(error: PersistenceError): boolean {
  return error.kind === 'payload_rejected' || error.kind === 'invalid';
}

interface MigrationOptions {
  gateway: PersistenceGateway;
  /** 사건 created_at 기준 시각(순서 보존용) */
  now?: Date;
  /** 이 사용자가 이미 저장한 관계의 localTargetId → cloudTargetId. 없으면 (userId, localTargetId)에서 만든다 */
  existingCloudIds?: Readonly<Record<string, string>>;
  /** 동의를 받은 사용자. 세션 사용자가 다르면(도중에 계정 전환) 아무것도 올리지 않는다 */
  expectedUserId?: string;
}

export async function migrateLocalData(
  input: MigrationOptions & {
    snapshot: LocalDataSnapshot;
    /** 사용자가 '계정에 저장하기'를 눌렀을 때만 true */
    consent: boolean;
  },
): Promise<MigrationReport> {
  if (input.consent !== true) return emptyMigrationReport('consent_required');

  const plan = planLocalMigration(input.snapshot);
  if (!plan.profile && plan.targets.length === 0 && plan.history.length === 0) {
    return emptyMigrationReport('nothing_to_migrate');
  }
  return migratePlan({ ...input, plan });
}

/**
 * 동의가 이미 확인된 plan을 올린다 — 기기 전체 저장(`migrateLocalData`)과 '이 관계 저장하기'
 * (`cloudLinks.saveRelationshipToCloud`)가 **같은 경로**를 쓴다.
 */
export async function migratePlan(input: MigrationOptions & { plan: MigrationPlan }): Promise<MigrationReport> {
  const { gateway, plan } = input;
  const uid = await gateway.currentUserId();
  if (!uid.ok) return emptyMigrationReport(uid.error.kind === 'offline' ? 'offline' : 'unauthorized');
  if (input.expectedUserId !== undefined && input.expectedUserId !== uid.value) {
    return emptyMigrationReport('unauthorized');
  }

  const result = emptyMigrationReport('completed');
  const profiles = createProfileRepository(gateway);
  const targets = createRelationshipTargetRepository(gateway);
  const events = createRelationshipEventRepository(gateway);
  const runs = createAnalysisRunRepository(gateway);
  const base = (input.now ?? new Date()).getTime();
  let stopped = false;

  const measure = (key: keyof MigrationCounts, row: unknown) => {
    const bytes = estimateUtf8Bytes(row);
    result.bytes[key] += bytes;
    result.bytes.total += bytes;
  };
  const failed = (entity: MigrationEntity, id: string, error: PersistenceError) => {
    if (isRejection(error)) {
      result.rejected.push({ entity, id, issues: error.issues ?? [] });
      return;
    }
    result.failures.push({ entity, id, kind: error.kind });
    if (error.kind === 'offline' || error.kind === 'unauthorized') stopped = true;
  };

  if (plan.profile) {
    measure('profile', profileRowOf(uid.value, plan.profile));
    const saved = await profiles.createIfAbsent(plan.profile);
    if (!saved.ok) failed('profile', uid.value, saved.error);
    else if (saved.value.created) result.created.profile += 1;
    else if (sameContent(saved.value.profile.data, plan.profile)) result.unchanged.profile += 1;
    else result.conflicts.push({ entity: 'profile', id: uid.value });
  }

  for (const target of plan.targets) {
    if (stopped) break;
    const cloudTargetId = input.existingCloudIds?.[target.id] ?? (await cloudTargetIdOf(uid.value, target.id));
    measure('targets', targetRowOf(uid.value, { ...target, id: cloudTargetId }));
    const saved = await targets.createIfAbsent({
      id: cloudTargetId,
      label: target.label,
      relationStatus: target.relationStatus,
      data: target.data,
    });
    if (!saved.ok) {
      /* 같은 id가 계정에서 보이지 않는다 = 다른 계정이 이미 가진 id. 건드리지 않고 충돌로 보고한다 */
      if (saved.error.kind === 'conflict') result.conflicts.push({ entity: 'target', id: cloudTargetId });
      else failed('target', cloudTargetId, saved.error);
      /* 상대가 올라가지 않았으면 그 상대의 사건도 올리지 않는다(FK · 섞임 방지) */
      continue;
    }
    if (saved.value.created) result.created.targets += 1;
    else if (
      sameContent(saved.value.target.data, target.data) &&
      saved.value.target.label === target.label &&
      saved.value.target.relationStatus === target.relationStatus
    ) {
      result.unchanged.targets += 1;
    } else {
      /* 계정의 상대가 이미 다르면 그 상대에 사건을 섞지 않는다 */
      result.conflicts.push({ entity: 'target', id: cloudTargetId });
      continue;
    }
    result.links.push({ localTargetId: target.id, cloudTargetId });

    for (const [index, event] of target.events.entries()) {
      if (stopped) break;
      const id = await cloudEventIdOf(cloudTargetId, event.id);
      const createdAt = new Date(base + index).toISOString();
      measure('events', eventRowOf(uid.value, cloudTargetId, id, event, createdAt));
      const stored = await events.createIfAbsent(cloudTargetId, event, { id, createdAt });
      if (!stored.ok) {
        if (stored.error.kind === 'conflict') result.conflicts.push({ entity: 'event', id });
        else failed('event', id, stored.error);
        continue;
      }
      if (stored.value.created) result.created.events += 1;
      else if (
        stored.value.event.event.type === event.type &&
        stored.value.event.event.description === event.description.trim() &&
        (stored.value.event.event.myReaction ?? '') === (event.myReaction ?? '').trim()
      ) {
        result.unchanged.events += 1;
      } else {
        result.conflicts.push({ entity: 'event', id });
      }
    }
  }

  /* 사건 원문은 relationship_events 행에만 있다 — 분석 스냅샷에 다시 들어가면 거부한다 */
  const sourceTexts = plan.targets.flatMap((target) =>
    target.events.flatMap((event) => [event.description, event.myReaction ?? '']),
  );
  for (const entry of plan.history) {
    if (stopped) break;
    const run = await historyEntryRunInput(entry, uid.value);
    measure('analysisRuns', runRowOf(uid.value, run));
    const stored = await runs.record({ ...run, forbiddenTexts: sourceTexts });
    if (!stored.ok) {
      if (stored.error.kind === 'conflict') result.conflicts.push({ entity: 'analysis_run', id: run.id });
      else failed('analysis_run', run.id, stored.error);
      continue;
    }
    if (stored.value.created) result.created.analysisRuns += 1;
    else if (stored.value.differs) result.conflicts.push({ entity: 'analysis_run', id: run.id });
    else result.unchanged.analysisRuns += 1;
  }

  const createdAny = Object.values(result.created).some((count) => count > 0);
  if (stopped) {
    result.status = createdAny ? 'partial' : result.failures.some((item) => item.kind === 'unauthorized') ? 'unauthorized' : 'offline';
  } else if (result.failures.length > 0) {
    result.status = createdAny ? 'partial' : 'failed';
  } else if (result.rejected.length > 0) {
    result.status = 'completed_with_rejections';
  } else if (result.conflicts.length > 0) {
    result.status = 'completed_with_conflicts';
  }
  return result;
}
