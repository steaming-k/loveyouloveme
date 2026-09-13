import type { RelationshipEvent, RelationshipHistoryEntry, SessionAnswers } from '@/types';

import { createAnalysisRunRepository } from './analysisRunRepository';
import type { PersistenceGateway } from './gateway';
import { cloudEventIdOf } from './ids';
import { sameContent, selfProfileFromSession, targetContextFromSession } from './mappers';
import { createProfileRepository } from './profileRepository';
import { createRelationshipEventRepository } from './relationshipEventRepository';
import { createRelationshipTargetRepository } from './relationshipTargetRepository';
import { historyEntryRunInput } from './snapshotGuard';
import { hasTargetContext, type TargetRegistryState } from './targetRegistry';
import type { PersistenceErrorKind, SelfProfileData, TargetContextData } from './types';

/**
 * v1.47 — **기기 → 계정** migration
 *
 * ```
 * 동의 없으면        아무 요청도 보내지 않는다(consent_required) — 자동 silent upload 금지
 * 로컬 데이터         읽기만 한다. 지우거나 바꾸지 않는다
 * 대상               나 · 지금 상대 · 보관된 상대 · 상대별 사건 · History 스냅샷
 * 제외               사진 · 사진 관찰 결과 · AI 캐시 · analytics
 * 멱등               stable id + insert-if-absent. 새로고침 · 재로그인 · 재시도해도 중복 없음
 * 이미 다른 값        덮어쓰지 않고 conflict로 보고한다
 * 중간 실패           멈추고 partial/offline — 재시도하면 남은 것만 들어간다
 * ```
 */

export interface LocalDataSnapshot {
  answers: SessionAnswers;
  history: readonly RelationshipHistoryEntry[];
  registry: TargetRegistryState;
}

export interface PlannedTarget {
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

export type MigrationStatus =
  | 'consent_required'
  | 'nothing_to_migrate'
  | 'unauthorized'
  | 'offline'
  | 'completed'
  | 'completed_with_conflicts'
  | 'partial'
  | 'failed';

export interface MigrationReport {
  status: MigrationStatus;
  created: MigrationCounts;
  unchanged: MigrationCounts;
  /** 계정에 이미 **다른 값**이 있어 건드리지 않은 것 — id만 담는다(본문 없음) */
  conflicts: { entity: MigrationEntity; id: string }[];
  failures: { entity: MigrationEntity; id: string; kind: PersistenceErrorKind }[];
}

function emptyCounts(): MigrationCounts {
  return { profile: 0, targets: 0, events: 0, analysisRuns: 0 };
}

function report(status: MigrationStatus): MigrationReport {
  return { status, created: emptyCounts(), unchanged: emptyCounts(), conflicts: [], failures: [] };
}

export async function migrateLocalData(input: {
  gateway: PersistenceGateway;
  snapshot: LocalDataSnapshot;
  /** 사용자가 '계정에 저장하기'를 눌렀을 때만 true */
  consent: boolean;
  /** 사건 created_at 기준 시각(순서 보존용) */
  now?: Date;
}): Promise<MigrationReport> {
  if (input.consent !== true) return report('consent_required');

  const plan = planLocalMigration(input.snapshot);
  if (!plan.profile && plan.targets.length === 0 && plan.history.length === 0) return report('nothing_to_migrate');

  const { gateway } = input;
  const uid = await gateway.currentUserId();
  if (!uid.ok) return report(uid.error.kind === 'offline' ? 'offline' : 'unauthorized');

  const result = report('completed');
  const profiles = createProfileRepository(gateway);
  const targets = createRelationshipTargetRepository(gateway);
  const events = createRelationshipEventRepository(gateway);
  const runs = createAnalysisRunRepository(gateway);
  const base = (input.now ?? new Date()).getTime();
  let stopped = false;

  const failed = (entity: MigrationEntity, id: string, kind: PersistenceErrorKind) => {
    result.failures.push({ entity, id, kind });
    if (kind === 'offline' || kind === 'unauthorized') stopped = true;
  };

  if (plan.profile) {
    const saved = await profiles.createIfAbsent(plan.profile);
    if (!saved.ok) failed('profile', uid.value, saved.error.kind);
    else if (saved.value.created) result.created.profile += 1;
    else if (sameContent(saved.value.profile.data, plan.profile)) result.unchanged.profile += 1;
    else result.conflicts.push({ entity: 'profile', id: uid.value });
  }

  for (const target of plan.targets) {
    if (stopped) break;
    const saved = await targets.createIfAbsent({
      id: target.id,
      label: target.label,
      relationStatus: target.relationStatus,
      data: target.data,
    });
    if (!saved.ok) {
      /* 같은 id가 계정에서 보이지 않는다 = 다른 계정이 이미 가진 id. 건드리지 않고 충돌로 보고한다 */
      if (saved.error.kind === 'conflict') result.conflicts.push({ entity: 'target', id: target.id });
      else failed('target', target.id, saved.error.kind);
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
      result.conflicts.push({ entity: 'target', id: target.id });
      continue;
    }

    for (const [index, event] of target.events.entries()) {
      if (stopped) break;
      const id = await cloudEventIdOf(target.id, event.id);
      const stored = await events.createIfAbsent(target.id, event, {
        id,
        createdAt: new Date(base + index).toISOString(),
      });
      if (!stored.ok) {
        if (stored.error.kind === 'conflict') result.conflicts.push({ entity: 'event', id });
        else failed('event', id, stored.error.kind);
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

  for (const entry of plan.history) {
    if (stopped) break;
    const run = await historyEntryRunInput(entry);
    const stored = await runs.record(run);
    if (!stored.ok) {
      if (stored.error.kind === 'conflict') result.conflicts.push({ entity: 'analysis_run', id: run.id });
      else failed('analysis_run', run.id, stored.error.kind);
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
  } else if (result.conflicts.length > 0) {
    result.status = 'completed_with_conflicts';
  }
  return result;
}
