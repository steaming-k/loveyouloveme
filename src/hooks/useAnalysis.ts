'use client';

import { useMemo } from 'react';

import { aiSelectors } from '@/services/aiService';
import { useSession } from '@/state/SessionProvider';
import type {
  CompatibilityResult,
  ConversationQuestion,
  MbtiLensReport,
  MirrorReport,
  RelationshipProfile,
} from '@/types';

/**
 * 결과 화면용 셀렉터 훅
 *
 * 계산식은 lib/logic 한 곳에만 있고, 화면은 이 훅으로만 결과를 읽는다.
 * 로딩 화면(S08/S20)은 aiService의 async API를 쓰고, 결과 화면 재방문 시에는
 * 같은 로직을 동기적으로 재사용해 로딩을 다시 보여주지 않는다.
 */

/** ⚠️ MBTI를 넘기지 않는다 — 동기화율은 관계 행동 신호(4축)만으로 계산한다. */
export function useCompatibility(): CompatibilityResult {
  const { answers } = useSession();
  return useMemo(
    () => aiSelectors.compatibility(answers.declared, answers.target),
    [answers.declared, answers.target],
  );
}

/** Supporting Lens — 두 MBTI가 모두 있을 때만 값이 있다. 없으면 화면에서 숨긴다. */
export function useMbtiLens(): MbtiLensReport | null {
  const { answers } = useSession();
  return useMemo(
    () => aiSelectors.mbtiLens(answers.mbti, answers.target.mbti),
    [answers.mbti, answers.target.mbti],
  );
}

/**
 * 관계 신호 질문 + (MBTI가 둘 다 있으면) 선호가 다른 축의 보조 질문.
 * MBTI 질문은 항상 관계 신호 질문 **뒤에** 붙고, 기존 질문을 대체하지 않는다.
 */
export function useConversationQuestions(): ConversationQuestion[] {
  const result = useCompatibility();
  const mbtiLens = useMbtiLens();
  return useMemo(
    () => [
      ...aiSelectors.conversationQuestions(result),
      ...aiSelectors.mbtiQuestions(mbtiLens),
    ],
    [result, mbtiLens],
  );
}

export function useMirror(): MirrorReport {
  const { answers } = useSession();
  return useMemo(
    () => aiSelectors.mirror(answers.declared, answers.experience),
    [answers.declared, answers.experience],
  );
}

export function useRelationshipProfile(): RelationshipProfile {
  const { answers } = useSession();
  return useMemo(
    () => aiSelectors.profile(answers.observations, answers.declared, answers.experience),
    [answers.observations, answers.declared, answers.experience],
  );
}

export function useHomeHighlights(): { key: string; value: string }[] {
  const { answers } = useSession();
  return useMemo(
    () => aiSelectors.homeHighlights(answers.declared, answers.experience),
    [answers.declared, answers.experience],
  );
}
