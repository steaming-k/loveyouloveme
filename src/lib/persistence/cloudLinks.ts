import type { SessionAnswers } from '@/types';

import { createAnalysisRunRepository } from './analysisRunRepository';
import type { PersistenceGateway } from './gateway';
import { cloudTargetIdOf, isUuid } from './ids';
import {
  emptyMigrationReport,
  MIGRATION_EXCLUDED,
  migratePlan,
  planLocalMigration,
  type MigrationReport,
  type PlannedTarget,
} from './localMigration';
import { createRelationshipEventRepository } from './relationshipEventRepository';
import { createRelationshipTargetRepository } from './relationshipTargetRepository';
import type { TargetRegistryState } from './targetRegistry';
import {
  ok,
  type AnalysisRun,
  type CloudEvent,
  type CloudTarget,
  type GeneratedAnalysisRun,
  type PersistenceError,
  type Result,
  type SelfProfileData,
} from './types';

/**
 * v1.47 Clean Base — **local/cloud id 분리 · 관계 저장 동의 · Guest local-first**
 *
 * ```
 * Guest                     분석 결과 = 이 기기에만. cloud 요청 0
 * 로그인                    그것만으로는 아무것도 올리지 않는다
 * '이 관계 저장하기' 동의   (userId, localTargetId) → cloudTargetId link를 만든다 — 그 사용자에게만
 * 저장한 관계의 분석        성공할 때마다 그 관계에 snapshot. 매번 다시 묻지 않는다
 * 계정 전환                 다른 사용자의 link는 보지 않는다 → 자동 공유 · 자동 복사 없음
 * ```
 *
 * ⚠️ localTargetId(`lym.targets.v1`)는 **이 기기의 상대 슬롯 이름**이지 cloud 소유 id가 아니다.
 *    같은 슬롯을 A와 B가 각각 저장하면 cloud id가 다르다(`cloudTargetIdOf` — 사용자 id가 섞인 결정론 UUID).
 * ⚠️ link는 이 기기의 localStorage에만 있다(`lym.cloudLinks.v1`). id와 동의 시각만 — 본문 · 별칭 · 이메일 없음.
 */

export const CLOUD_LINKS_KEY = 'lym.cloudLinks.v1';

export interface CloudLink {
  cloudTargetId: string;
  consentedAt: string;
}

export interface CloudLinkState {
  version: 1;
  /** userId → localTargetId → link */
  byUser: Record<string, Record<string, CloudLink>>;
}

export function createCloudLinks(): CloudLinkState {
  return { version: 1, byUser: {} };
}

export function linkOf(state: CloudLinkState, userId: string, localTargetId: string): CloudLink | null {
  return state.byUser[userId]?.[localTargetId] ?? null;
}

/** 이 사용자의 link만 — migration에 넘길 기존 cloud id */
export function cloudIdsForUser(state: CloudLinkState, userId: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(state.byUser[userId] ?? {}).map(([localTargetId, link]) => [localTargetId, link.cloudTargetId]),
  );
}

function withLink(state: CloudLinkState, userId: string, localTargetId: string, link: CloudLink): CloudLinkState {
  return {
    version: 1,
    byUser: { ...state.byUser, [userId]: { ...(state.byUser[userId] ?? {}), [localTargetId]: link } },
  };
}

/** '이 관계 저장하기' — **이 사용자에게만** cloud id를 만든다. 이미 동의했으면 그대로 */
export async function grantRelationshipSave(
  state: CloudLinkState,
  userId: string,
  localTargetId: string,
  now: string,
): Promise<{ state: CloudLinkState; link: CloudLink; created: boolean }> {
  const existing = linkOf(state, userId, localTargetId);
  if (existing) return { state, link: existing, created: false };
  const link: CloudLink = { cloudTargetId: await cloudTargetIdOf(userId, localTargetId), consentedAt: now };
  return { state: withLink(state, userId, localTargetId, link), link, created: true };
}

/** 기기 전체 저장(동의 버튼) 뒤 — 계정에 들어간 상대마다 link를 남긴다. 기존 link는 바꾸지 않는다 */
export function applyMigrationLinks(
  state: CloudLinkState,
  userId: string,
  links: MigrationReport['links'],
  now: string,
): CloudLinkState {
  return links.reduce(
    (next, item) =>
      linkOf(next, userId, item.localTargetId)
        ? next
        : withLink(next, userId, item.localTargetId, { cloudTargetId: item.cloudTargetId, consentedAt: now }),
    state,
  );
}

/** 계정 저장분을 지운 뒤 — **그 사용자의** link만 지운다 */
export function forgetUser(state: CloudLinkState, userId: string): CloudLinkState {
  return { version: 1, byUser: Object.fromEntries(Object.entries(state.byUser).filter(([id]) => id !== userId)) };
}

export type AnalysisSaveDecision =
  | { save: false; reason: 'guest' | 'relationship_not_saved' }
  | { save: true; cloudTargetId: string };

/** 성공한 분석을 계정에 남길지. 매번 묻지 않는다 — **이 사용자의 관계 저장 동의**가 기준이다 */
export function analysisSaveDecision(input: {
  userId: string | null;
  localTargetId: string;
  links: CloudLinkState;
}): AnalysisSaveDecision {
  if (!input.userId) return { save: false, reason: 'guest' };
  const link = linkOf(input.links, input.userId, input.localTargetId);
  if (!link) return { save: false, reason: 'relationship_not_saved' };
  return { save: true, cloudTargetId: link.cloudTargetId };
}

/** 동의한 관계 한 명 저장(상대 · 사건). 멱등 — 기기 전체 저장과 같은 경로(`migratePlan`) */
export async function saveRelationshipToCloud(input: {
  gateway: PersistenceGateway;
  userId: string;
  links: CloudLinkState;
  target: PlannedTarget;
  /** 나 최소값(migration과 같은 allowlist) — 생략하면 올리지 않는다 */
  profile?: SelfProfileData | null;
  now?: Date;
}): Promise<MigrationReport> {
  const link = linkOf(input.links, input.userId, input.target.id);
  if (!link) return emptyMigrationReport('consent_required');
  return migratePlan({
    gateway: input.gateway,
    plan: { profile: input.profile ?? null, targets: [input.target], history: [], excluded: MIGRATION_EXCLUDED },
    now: input.now,
    existingCloudIds: { [input.target.id]: link.cloudTargetId },
    expectedUserId: input.userId,
  });
}

export type AnalysisSnapshotOutcome =
  | { status: 'skipped'; reason: 'guest' | 'relationship_not_saved' }
  | { status: 'recorded'; created: boolean; run: AnalysisRun }
  | { status: 'failed'; error: PersistenceError };

/** 저장한 관계의 성공한 분석 → 그 관계에 snapshot. 저장하지 않은 관계 · Guest는 요청 0 */
export async function recordAnalysisForRelationship(input: {
  gateway: PersistenceGateway;
  decision: AnalysisSaveDecision;
  run: Omit<GeneratedAnalysisRun, 'targetId'> & { targetId?: string | null };
  /** 사건 본문 · 반응 — 스냅샷에 다시 들어가면 거부한다 */
  forbiddenTexts?: readonly string[];
}): Promise<AnalysisSnapshotOutcome> {
  if (!input.decision.save) return { status: 'skipped', reason: input.decision.reason };
  const stored = await createAnalysisRunRepository(input.gateway).recordGenerated({
    ...input.run,
    targetId: input.decision.cloudTargetId,
    forbiddenTexts: input.forbiddenTexts,
  });
  if (!stored.ok) return { status: 'failed', error: stored.error };
  return { status: 'recorded', created: stored.value.created, run: stored.value.run };
}

export interface SavedRelationship {
  target: CloudTarget;
  events: CloudEvent[];
  latestAnalysis: AnalysisRun | null;
}

/** 저장한 관계 불러오기 — 상대 · 사건 · 최근 분석. 내 행이 아니면(RLS) null */
export async function loadSavedRelationship(
  gateway: PersistenceGateway,
  cloudTargetId: string,
): Promise<Result<SavedRelationship | null>> {
  const target = await createRelationshipTargetRepository(gateway).get(cloudTargetId);
  if (!target.ok) return target;
  if (!target.value) return ok(null);
  const events = await createRelationshipEventRepository(gateway).listByTarget(cloudTargetId);
  if (!events.ok) return events;
  const latest = await createAnalysisRunRepository(gateway).latestForTarget(cloudTargetId);
  if (!latest.ok) return latest;
  return ok({ target: target.value, events: events.value, latestAnalysis: latest.value });
}

const SAVE_FAILURE_STATUSES: ReadonlySet<MigrationReport['status']> = new Set([
  'consent_required',
  'nothing_to_migrate',
  'unauthorized',
  'offline',
  'partial',
  'failed',
]);

/**
 * v1.47 Integration — '이 관계 저장하기' 동의 뒤. 지금 상대 한 명(나 최소값 · 상대 · 사건)을 저장하고 link를 돌려준다.
 *
 * ⚠️ 저장이 실패하거나 상대가 계정에 들어가지 않았으면 link를 돌려주지 않는다('저장됨'으로 보이지 않게).
 * ⚠️ 로컬 데이터는 읽기만 한다.
 */
export async function saveActiveRelationshipWith(input: {
  gateway: PersistenceGateway;
  userId: string;
  answers: SessionAnswers;
  registry: TargetRegistryState;
  links: CloudLinkState;
  now: string;
}): Promise<{ saved: boolean; report: MigrationReport; links: CloudLinkState }> {
  const plan = planLocalMigration({ answers: input.answers, history: [], registry: input.registry });
  const target = plan.targets.find((item) => item.active);
  if (!target) return { saved: false, report: emptyMigrationReport('nothing_to_migrate'), links: input.links };
  const granted = await grantRelationshipSave(input.links, input.userId, target.id, input.now);
  const report = await saveRelationshipToCloud({
    gateway: input.gateway,
    userId: input.userId,
    links: granted.state,
    target,
    profile: plan.profile,
  });
  const saved = !SAVE_FAILURE_STATUSES.has(report.status) && report.links.some((item) => item.localTargetId === target.id);
  return { saved, report, links: saved ? granted.state : input.links };
}

/**
 * v1.47 Integration §28 — **link 복구.** localStorage link를 잃어버린 기기.
 *
 * cloud 상대 id는 (userId, localTargetId)의 결정론 UUID라, **읽기만 해서** 같은 관계를 다시 찾는다.
 * ⚠️ 업로드하지 않는다. 다른 사용자의 행은 RLS 때문에 보이지 않으므로 복구되지 않는다.
 * ⚠️ 기기의 상대 목록(lym.targets.v1)까지 사라져 localTargetId가 바뀌면 복구할 수 없다(알려진 한계).
 */
export async function recoverCloudLink(input: {
  gateway: PersistenceGateway;
  userId: string;
  localTargetId: string;
  links: CloudLinkState;
  now: string;
}): Promise<{ recovered: boolean; link: CloudLink | null; links: CloudLinkState }> {
  const existing = linkOf(input.links, input.userId, input.localTargetId);
  if (existing) return { recovered: false, link: existing, links: input.links };
  const cloudTargetId = await cloudTargetIdOf(input.userId, input.localTargetId);
  const target = await createRelationshipTargetRepository(input.gateway).get(cloudTargetId);
  if (!target.ok || !target.value) return { recovered: false, link: null, links: input.links };
  const link: CloudLink = { cloudTargetId, consentedAt: input.now };
  return { recovered: true, link, links: withLink(input.links, input.userId, input.localTargetId, link) };
}

/* ───────────────────────────────────────────────────── 브라우저 저장 */

export function sanitizeCloudLinks(raw: unknown): CloudLinkState {
  const state = createCloudLinks();
  if (typeof raw !== 'object' || raw === null) return state;
  const value = raw as { version?: unknown; byUser?: unknown };
  if (value.version !== 1 || typeof value.byUser !== 'object' || value.byUser === null) return state;
  for (const [userId, links] of Object.entries(value.byUser as Record<string, unknown>)) {
    if (!isUuid(userId) || typeof links !== 'object' || links === null) continue;
    const clean: Record<string, CloudLink> = {};
    for (const [localTargetId, link] of Object.entries(links as Record<string, unknown>)) {
      const item = (typeof link === 'object' && link !== null ? link : {}) as { cloudTargetId?: unknown; consentedAt?: unknown };
      const cloudTargetId = item.cloudTargetId;
      if (!isUuid(localTargetId) || !isUuid(cloudTargetId) || typeof item.consentedAt !== 'string') continue;
      clean[localTargetId] = { cloudTargetId, consentedAt: item.consentedAt };
    }
    if (Object.keys(clean).length > 0) state.byUser[userId] = clean;
  }
  return state;
}

export function readCloudLinks(): CloudLinkState {
  if (typeof window === 'undefined') return createCloudLinks();
  try {
    const raw = window.localStorage.getItem(CLOUD_LINKS_KEY);
    return raw ? sanitizeCloudLinks(JSON.parse(raw)) : createCloudLinks();
  } catch {
    return createCloudLinks();
  }
}

/** 저장 실패는 흐름을 막지 않는다(세션 저장과 같은 정책). 성공 여부만 돌려준다 */
export function writeCloudLinks(state: CloudLinkState): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(CLOUD_LINKS_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
