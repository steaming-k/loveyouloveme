import { STATUS_LABEL } from '@/data/labels';
import { createEmptyTargetProfile } from '@/state/defaultAnswers';
import type { SessionAnswers } from '@/types';

import { applyMigrationLinks, loadSavedRelationship, type CloudLinkState } from './cloudLinks';
import type { PersistenceGateway } from './gateway';
import { sessionWithCloudContext } from './mappers';
import { preserveActiveTarget, type TargetRegistryState } from './targetRegistry';
import type { PersistenceErrorKind, SavedRelationshipSummary } from './types';

/**
 * v1.47 — **저장한 관계** 목록 · 열기(hydrate). 순수 함수 — 화면과 fixture가 같은 함수를 부른다.
 *
 * ```
 * 목록   별칭(없으면 '이름 없는 관계') · 관계 상태 · 최근 분석 날짜. 분석이 최근인 관계가 위
 * 열기   cloud 상대 · 사건 → 세션. 지금 상대는 기기 목록(lym.targets.v1)에 보관한다
 *        현재 관계 근거 · 저장 질문 · 사건은 **그 관계의 cloud 값**으로 바뀐다(이전 상대 값이 따라가지 않는다)
 * ```
 *
 * ⚠️ 별칭을 자르지 않는다 — 긴 별칭은 화면에서 말줄임으로만 처리한다.
 * ⚠️ 이미 보고 있는 관계를 다시 열면 아무것도 바꾸지 않는다(이 기기의 저장 전 수정이 사라지지 않게).
 */

export const SAVED_RELATIONSHIPS_COPY = {
  label: '저장한 관계',
  emptyTitle: '아직 저장한 관계가 없어.',
  emptyDetail: '관계를 저장하면 다음에 다시 볼 수 있어.',
  unnamed: '이름 없는 관계',
  noAnalysis: '아직 분석 기록 없음',
  open: '열기',
  current: '보는 중',
  opening: '여는 중',
  loading: '저장한 관계를 불러오고 있어.',
  failed: '지금은 불러오지 못했어. 이 기기에 있는 정보는 그대로야.',
  retry: '다시 불러오기',
} as const;

export interface SavedRelationshipRow {
  cloudTargetId: string;
  title: string;
  statusLabel: string | null;
  analysisLine: string;
  current: boolean;
}

function monthDay(iso: string, timeZone: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, month: 'numeric', day: 'numeric' }).formatToParts(date);
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return month && day ? `${month}월 ${day}일` : null;
}

export function savedRelationshipRows(
  summaries: readonly SavedRelationshipSummary[],
  options: { currentCloudTargetId: string | null; timeZone?: string },
): SavedRelationshipRow[] {
  const timeZone = options.timeZone ?? 'Asia/Seoul';
  return summaries
    .filter((item) => !item.archived)
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const left = a.item.lastAnalysisAt;
      const right = b.item.lastAnalysisAt;
      if (left && right && left !== right) return right.localeCompare(left);
      if (left && !right) return -1;
      if (!left && right) return 1;
      return a.index - b.index;
    })
    .map(({ item }) => {
      const date = item.lastAnalysisAt ? monthDay(item.lastAnalysisAt, timeZone) : null;
      return {
        cloudTargetId: item.id,
        title: item.label ?? SAVED_RELATIONSHIPS_COPY.unnamed,
        statusLabel: item.relationStatus ? STATUS_LABEL[item.relationStatus] : null,
        analysisLine: date ? `최근 분석 ${date}` : SAVED_RELATIONSHIPS_COPY.noAnalysis,
        current: item.id === options.currentCloudTargetId,
      };
    });
}

export type HydrateSavedRelationshipResult =
  | {
      ok: true;
      alreadyActive: boolean;
      answers: SessionAnswers;
      registry: TargetRegistryState;
      links: CloudLinkState;
      localTargetId: string;
      latestAnalysisAt: string | null;
    }
  | { ok: false; reason: 'not_found' | PersistenceErrorKind };

export async function hydrateSavedRelationship(input: {
  gateway: PersistenceGateway;
  userId: string;
  cloudTargetId: string;
  answers: SessionAnswers;
  registry: TargetRegistryState;
  links: CloudLinkState;
  now: string;
  /** 새 분석 단위 id(funnelAnalysisId) — 호출부가 만든다(순수 함수 유지) */
  newAnalysisId: string;
}): Promise<HydrateSavedRelationshipResult> {
  const loaded = await loadSavedRelationship(input.gateway, input.cloudTargetId);
  if (!loaded.ok) return { ok: false, reason: loaded.error.kind };
  if (!loaded.value) return { ok: false, reason: 'not_found' };
  const { target, events, latestAnalysis } = loaded.value;

  /* 이 사용자가 이 기기에서 저장한 관계면 그 슬롯, 다른 기기에서 저장한 관계면 cloud id를 슬롯 이름으로 쓴다 */
  const mine = Object.entries(input.links.byUser[input.userId] ?? {}).find(([, link]) => link.cloudTargetId === target.id);
  const localTargetId = mine?.[0] ?? target.id;
  const links = applyMigrationLinks(input.links, input.userId, [{ localTargetId, cloudTargetId: target.id }], input.now);

  if (localTargetId === input.registry.activeTargetId) {
    return {
      ok: true,
      alreadyActive: true,
      answers: input.answers,
      registry: input.registry,
      links,
      localTargetId,
      latestAnalysisAt: latestAnalysis?.createdAt ?? null,
    };
  }

  const preserved = preserveActiveTarget(input.registry, input.answers, localTargetId, input.now);
  const registry: TargetRegistryState = {
    ...preserved,
    activeTargetId: localTargetId,
    activeLabel: target.label,
    saved: preserved.saved.filter((item) => item.id !== localTargetId),
  };
  const cleared: SessionAnswers = {
    ...input.answers,
    target: createEmptyTargetProfile(),
    currentRelationship: { signals: {}, askedAt: null },
    savedQuestions: [],
    completed: { ...input.answers.completed, compatibility: false },
  };
  const hydrated = sessionWithCloudContext(cleared, {
    profile: null,
    target: target.data,
    events: events.map((item) => item.event),
  });
  const answers: SessionAnswers = {
    ...hydrated,
    status: target.relationStatus ?? input.answers.status,
    currentAnalysisMeta: {
      mirrorViewedAt: input.answers.currentAnalysisMeta?.mirrorViewedAt,
      updatedAt: input.now,
      funnelAnalysisId: input.newAnalysisId,
    },
  };
  return { ok: true, alreadyActive: false, answers, registry, links, localTargetId, latestAnalysisAt: latestAnalysis?.createdAt ?? null };
}
