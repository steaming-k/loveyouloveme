'use client';

import { useMemo } from 'react';

import { aiSelectors } from '@/services/aiService';
import { useSession } from '@/state/SessionProvider';
import type {
  CompatibilityResult,
  ConversationQuestion,
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

export function useCompatibility(): CompatibilityResult {
  const { answers } = useSession();
  return useMemo(
    () => aiSelectors.compatibility(answers.declared, answers.target, answers.mbti),
    [answers.declared, answers.target, answers.mbti],
  );
}

export function useConversationQuestions(): ConversationQuestion[] {
  const result = useCompatibility();
  return useMemo(() => aiSelectors.conversationQuestions(result), [result]);
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
