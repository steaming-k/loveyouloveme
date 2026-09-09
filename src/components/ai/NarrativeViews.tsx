'use client';

import { AiNarrativeBlock, AiNarrativeSkeleton } from '@/components/ai/AiNarrativeBlock';
import { useEvidenceContext } from '@/hooks/useAiNarrative';
import {
  coreNarrativeForRender,
  narrativeIsShowable,
  resolveEvidenceRefs,
} from '@/lib/aiEvidenceResolver';
import type {
  AiNarrativeStatus,
  CompatibilityNarrative,
  CoreInsightNarrative,
  HistoryNarrative,
  MirrorAxisKey,
  RelationshipNarrative,
  TargetAxisKey,
} from '@/types';

/**
 * Narrative → 화면 (v1.7)
 *
 * 세 화면이 각자 다른 방식으로 AI 문장을 그리지 않도록 여기 모아둔다.
 *
 * 공통 규칙:
 *   - `loading`이면 skeleton만. Core UI는 이미 위에 렌더돼 있다(§16).
 *   - 해당 축의 Narrative가 없으면 **아무것도 그리지 않는다.** 빈 카드를 만들지 않는다.
 *   - 유효한 근거도 한계 문장도 없으면 그리지 않는다(§35).
 */

/* ------------------------------------------------- Compatibility */

export function CompatibilityAxisNarrative({
  axis,
  narratives,
  status,
}: {
  axis: TargetAxisKey | undefined;
  narratives: readonly CompatibilityNarrative[] | undefined;
  status: AiNarrativeStatus;
}) {
  const context = useEvidenceContext();

  if (status === 'loading') return <AiNarrativeSkeleton />;
  if (!axis || !narratives) return null;

  const narrative = narratives.find((item) => item.dimensionKey === axis);
  if (!narrative || !narrativeIsShowable(narrative, context)) return null;

  return (
    <AiNarrativeBlock
      task="compatibility-narrative"
      explanation={narrative.explanation}
      scenario={narrative.scenario}
      uncertainty={narrative.uncertainty}
      question={narrative.conversationQuestion}
      evidence={resolveEvidenceRefs(narrative.evidenceRefs, context)}
    />
  );
}

/* -------------------------------------------------- Relationship */

/**
 * S27 Mirror row에 붙는 1~2줄 설명 (§21).
 * 이 화면의 주인공은 전체 Mirror Map이므로 축마다 긴 글을 붙이지 않는다 —
 * headline은 생략하고 explanation만 쓴다.
 */
export function MirrorAxisNarrative({
  axis,
  narratives,
  status,
}: {
  axis: MirrorAxisKey;
  narratives: readonly RelationshipNarrative[] | undefined;
  status: AiNarrativeStatus;
}) {
  const context = useEvidenceContext();

  if (status === 'loading' || !narratives) return null;

  const narrative = narratives.find((item) => item.axis === axis);
  if (!narrative || !narrativeIsShowable(narrative, context)) return null;

  return (
    <AiNarrativeBlock
      task="relationship-insight"
      explanation={narrative.explanation}
      uncertainty={narrative.uncertainty}
      question={narrative.question}
      evidence={resolveEvidenceRefs(narrative.evidenceRefs, context)}
      className="mt-2"
    />
  );
}

/* --------------------------------------------------- Core Insight */

/**
 * S28에서 쓴다. **Evidence List는 여기서 만들지 않는다** —
 * deterministic 근거 목록은 화면이 그대로 유지하고(§22), 이 블록은 설명만 담당한다.
 */
export function CoreInsightNarrativeView({
  core: rawCore,
  status,
}: {
  core: CoreInsightNarrative | null | undefined;
  status: AiNarrativeStatus;
}) {
  const context = useEvidenceContext();

  /**
   * v1.43 §48 — **USER CORRECTION TRUST BOUNDARY.**
   *
   * 사용자가 Core 판정을 직접 고쳤으면 AI의 Core 서술은 화면에 오지 않는다. 화면의
   * headline이 사용자 문장으로 교체되므로, 그 아래 남은 AI summary는 **화면에 없는
   * 문장을 설명하는 문장**이 된다(실측 재현: §48.2).
   *
   * ⚠️ 판정을 여기서 쓰지 않고 `coreNarrativeForRender`를 부른다 — 이 컴포넌트가
   * 유일한 렌더 지점이지만, 규칙을 컴포넌트 안에 인라인으로 쓰면 **다음 렌더 지점이
   * 그것을 물려받지 못한다.** v1.43 §8.14가 compatibility 질문 누출에서 배운 형태다.
   */
  const core = coreNarrativeForRender(rawCore, context.answers);

  if (status === 'loading') return <AiNarrativeSkeleton label="러비가 근거를 정리하고 있어…" />;
  if (!core) return null;

  const evidence = resolveEvidenceRefs(core.evidenceRefs, context);
  // Core Insight는 제품의 종착점이다 — 근거 없이 해석을 보여주지 않는다.
  if (evidence.length === 0) return null;

  return (
    <AiNarrativeBlock
      task="relationship-insight"
      explanation={core.summary}
      uncertainty={core.limitations[0]}
      evidence={evidence}
    />
  );
}

/* -------------------------------------------------------- History */

/** F2 그룹별 짧은 맥락 요약 (§29). 규칙이 만든 변화 문장 **아래**에 붙는다 */
export function HistoryAxisNarrative({
  axis,
  narratives,
  status,
}: {
  axis: MirrorAxisKey;
  narratives: readonly HistoryNarrative[] | undefined;
  status: AiNarrativeStatus;
}) {
  const context = useEvidenceContext();

  if (status === 'loading' || !narratives) return null;

  const narrative = narratives.find((item) => item.axis === axis);
  if (!narrative || !narrativeIsShowable(narrative, context)) return null;

  return (
    <AiNarrativeBlock
      task="history-insight"
      explanation={narrative.explanation}
      uncertainty={narrative.uncertainty}
      evidence={resolveEvidenceRefs(narrative.evidenceRefs, context)}
      className="mt-2"
    />
  );
}
