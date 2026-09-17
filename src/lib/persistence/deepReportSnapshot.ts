import type {
  AiMode,
  AiNarrativeStatus,
  DeepNarrativeBundle,
  RelationshipDeepReport,
  RelationshipEvent,
} from '@/types';

import {
  analysisSaveDecision,
  recordAnalysisForRelationship,
  type AnalysisSnapshotOutcome,
  type CloudLinkState,
} from './cloudLinks';
import type { PersistenceGateway } from './gateway';
import { cloudEventIdOf } from './ids';
import { deepReportRunInput } from './snapshotGuard';

/**
 * v1.47 Integration — **Deep Report analysis_run 저장 시점과 조건**
 *
 * ```
 * 저장     로그인 · 이 사용자가 저장한 관계 · Provider 성공 · semantic/action 게이트 통과 · 화면에 렌더됨
 * 안 함    Guest · 저장 안 한 관계 · Provider 실패 · demo · 게이트 거부(AI 문장 0) · verify_only fallback만 ·
 *          렌더 전 · generationRequestId 없음
 * ```
 *
 * ⚠️ 판정 순서: 저장 대상인가(요청 0) → 저장할 만한 결과인가 → 저장. Guest는 어떤 요청도 만들지 않는다.
 * ⚠️ 스냅샷의 사건 id는 **cloud 사건 id**로 바꿔 저장한다 — 다른 기기에서 불러온 사건과 이어진다.
 */

export type DeepReportSnapshotSkip =
  | 'guest'
  | 'relationship_not_saved'
  | 'not_rendered'
  | 'provider_failed'
  | 'not_ai_mode'
  | 'report_unavailable'
  | 'gate_rejected'
  | 'verify_only_fallback'
  | 'missing_generation_id';

const SAVABLE_MODES: readonly string[] = ['real', 'mock'];

export function deepReportSnapshotEligibility(input: {
  rendered: boolean;
  status: AiNarrativeStatus;
  mode: AiMode | null;
  bundle: DeepNarrativeBundle | null;
  report: RelationshipDeepReport | null;
}): { eligible: true } | { eligible: false; reason: DeepReportSnapshotSkip } {
  if (!input.rendered) return { eligible: false, reason: 'not_rendered' };
  if (input.status !== 'ready' || !input.bundle) return { eligible: false, reason: 'provider_failed' };
  if (!input.mode || !SAVABLE_MODES.includes(input.mode) || !SAVABLE_MODES.includes(input.bundle.meta.mode)) {
    return { eligible: false, reason: 'not_ai_mode' };
  }
  if (!input.report?.available) return { eligible: false, reason: 'report_unavailable' };
  const semanticCards = input.report.candidates.slice(0, 3).filter((card) => card.soWhatSource === 'semantic_ai').length;
  const plan = input.report.actionPlan;
  const planAccepted = plan?.source === 'semantic_ai' && plan.mode === 'plan';
  if (semanticCards === 0 && !planAccepted) {
    return { eligible: false, reason: plan?.mode === 'verify_only' ? 'verify_only_fallback' : 'gate_rejected' };
  }
  if (!input.bundle.generationRequestId) return { eligible: false, reason: 'missing_generation_id' };
  return { eligible: true };
}

export type DeepReportSnapshotOutcome =
  | { status: 'skipped'; reason: DeepReportSnapshotSkip }
  | Exclude<AnalysisSnapshotOutcome, { status: 'skipped' }>;

export async function persistDeepReportSnapshot(input: {
  gateway: PersistenceGateway | null;
  userId: string | null;
  links: CloudLinkState;
  /** 이 기기의 상대 슬롯 id — link로 cloud 상대를 찾는다 */
  localTargetId: string;
  rendered: boolean;
  status: AiNarrativeStatus;
  mode: AiMode | null;
  bundle: DeepNarrativeBundle | null;
  report: RelationshipDeepReport | null;
  /** 이 상대의 로컬 사건 — cloud 사건 id 변환 · 원문 복제 검사 */
  events: readonly RelationshipEvent[];
}): Promise<DeepReportSnapshotOutcome> {
  const decision = analysisSaveDecision({ userId: input.userId, localTargetId: input.localTargetId, links: input.links });
  if (!decision.save) return { status: 'skipped', reason: decision.reason };
  if (!input.gateway) return { status: 'skipped', reason: 'guest' };

  const eligibility = deepReportSnapshotEligibility(input);
  if (!eligibility.eligible) return { status: 'skipped', reason: eligibility.reason };
  const bundle = input.bundle as DeepNarrativeBundle;
  const report = input.report as RelationshipDeepReport;

  const cloudEventIds = new Map<string, string>();
  for (const event of input.events) {
    cloudEventIds.set(event.id, await cloudEventIdOf(decision.cloudTargetId, event.id));
  }
  const outcome = await recordAnalysisForRelationship({
    gateway: input.gateway,
    decision,
    run: deepReportRunInput({
      targetId: decision.cloudTargetId,
      report,
      promptVersion: bundle.meta.promptVersion,
      model: bundle.meta.model ?? null,
      sourceFingerprint: bundle.meta.inputFingerprint,
      generationRequestId: bundle.generationRequestId as string,
      eventIdOf: (localEventId) => cloudEventIds.get(localEventId) ?? localEventId,
    }),
    forbiddenTexts: input.events.flatMap((event) => [event.description, event.myReaction ?? '']),
  });
  if (outcome.status === 'skipped') return { status: 'skipped', reason: outcome.reason };
  return outcome;
}
