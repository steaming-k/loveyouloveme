'use client';

import { useEffect, useRef } from 'react';

import { NoticeBox, Tag } from '@/components/common/primitives';
import { trackEvent } from '@/lib/analytics';
import type { AiFailureReason, AiMode, AiNarrativeStatus, AiTask } from '@/types';

/**
 * AI 모드 고지 — 세 화면에서 공용 (v1.7 · §32 · §64 · §65)
 *
 * 화면마다 즉흥적으로 다른 문구를 만들지 않기 위해 여기 한 곳에서만 정의한다.
 *
 * ⚠️ **Badge를 크게 쓰지 않는다.** 이 제품은 Relationship Self-understanding이지
 * AI Showcase가 아니다(§65). S09만 명확히 표시하고, S22/S27/S28/F2는 작은 라벨·footer note다.
 */

const FALLBACK_COPY: Partial<Record<AiFailureReason, string>> = {
  CONFIG_ERROR: '지금은 러비의 상세 설명 없이 확인된 신호만 보여주고 있어.',
  SERVER_ERROR: '러비가 설명을 정리하지 못해서 확인된 신호만 보여주고 있어.',
  TIMEOUT: '설명을 정리하는 데 시간이 너무 걸려서 확인된 신호만 보여주고 있어.',
  NETWORK_ERROR: '통신이 끊겨서 확인된 신호만 보여주고 있어.',
  INVALID_OUTPUT: '설명을 제대로 읽지 못해서 확인된 신호만 보여주고 있어.',
  POLICY_BLOCK: '이 내용으로는 설명을 만들지 못해서 확인된 신호만 보여주고 있어.',
  RATE_LIMIT: '요청이 조금 몰렸어. 확인된 신호만 먼저 보여주고 있어.',
  NO_USABLE_IMAGE: '분석에 쓸 수 있는 자료가 없어서 확인된 신호만 보여주고 있어.',
};

/** 작은 출처 라벨 — AI 설명 섹션 제목 옆에 붙인다 */
export function AiSourceLabel({ mode }: { mode: AiMode | null }) {
  if (mode === 'real') return <Tag tone="neutral">AI 설명</Tag>;
  // 개발 전용 mock을 'AI 설명'으로 표시하지 않는다 — 실제 Provider 응답이 아니다(§5).
  if (mode === 'mock') return <Tag tone="friction">MOCK AI</Tag>;
  if (mode === 'fallback') return <Tag tone="friction">규칙 기반 대체</Tag>;
  return null;
}

/**
 * 하단 고지. `status`가 `unavailable`일 때만 무언가를 말한다.
 *
 * demo 모드에서 조용히 아무 말도 하지 않는 이유: demo는 애초에 Narrative를 만들지 않고
 * 화면이 기존 deterministic 콘텐츠를 그대로 쓴다 — 사용자에게 달라진 게 없다.
 * 반면 **real을 시도했다가 실패한 경우는 반드시 알린다**(§15).
 */
export function AiNarrativeNotice({
  task,
  status,
  reason,
  onRetry,
}: {
  task: AiTask;
  status: AiNarrativeStatus;
  reason: AiFailureReason | null;
  /**
   * v1.17 — Premium(₩1,900)처럼 사용자가 AI 설명 자체에 대가를 지불한 화면에서만 넘긴다.
   * 무료 화면(S22/S27/S28/F2)은 넘기지 않는다 — Core Result가 이미 보이고 있어 재시도를
   * 조를 이유가 없다(§15). 재시도 가능한 이유만 버튼을 보여준다 — POLICY_BLOCK처럼
   * 다시 불러도 같은 결과가 나올 사유는 버튼을 숨긴다.
   */
  onRetry?: () => void;
}) {
  const firedRef = useRef(false);

  useEffect(() => {
    // §86 — StrictMode 이중 마운트로 중복 발생하지 않게 mount 기준 1회만.
    if (status !== 'unavailable' || !reason || firedRef.current) return;
    firedRef.current = true;
    trackEvent('ai_narrative_fallback_view', { task, reason });
  }, [status, reason, task]);

  if (status !== 'unavailable' || !reason) return null;

  const retryable = onRetry && reason !== 'POLICY_BLOCK' && reason !== 'NO_USABLE_IMAGE';

  return (
    <NoticeBox>
      <span>{FALLBACK_COPY[reason] ?? FALLBACK_COPY.SERVER_ERROR}</span>
      {retryable ? (
        <button
          type="button"
          onClick={onRetry}
          className="ml-2 font-semibold text-brand-pressed underline underline-offset-2"
        >
          다시 시도
        </button>
      ) : null}
    </NoticeBox>
  );
}

/**
 * Narrative가 실제로 보였을 때 1회 기록 (§85)
 *
 * `source`(화면)를 함께 보내는 이유: relationship narrative는 S27과 S28 **두 화면**에서
 * 보이므로 task만으로는 어느 화면에서 본 것인지 구분할 수 없다. 화면별로 나눠 봐야
 * '어디서 실제로 읽히는지'를 알 수 있다.
 */
export function useNarrativeViewEvent(input: {
  task: AiTask;
  source: string;
  status: AiNarrativeStatus;
  mode: AiMode | null;
  itemCount: number;
}): void {
  const { task, source, status, mode, itemCount } = input;
  const firedRef = useRef(false);

  useEffect(() => {
    // §86 — mount 기준 1회. StrictMode 이중 마운트·리렌더로 중복되지 않게 한다.
    // 세션 전체 dedup은 쓰지 않는다 — 사용자가 실제로 다시 본 것은 다시 센다.
    if (status !== 'ready' || firedRef.current) return;
    firedRef.current = true;
    trackEvent('ai_narrative_view', {
      task,
      source,
      mode: mode ?? 'unknown',
      result_items: itemCount,
    });
  }, [status, task, source, mode, itemCount]);
}
