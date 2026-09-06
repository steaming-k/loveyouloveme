'use client';

import { useMemo } from 'react';

import { buildApproachHints } from '@/lib/logic/approachHints';
import { soloModeOf } from '@/lib/logic/soloMode';
import {
  analysisFingerprint,
  buildHistoryReport,
  findRepeatedRelationshipSignals,
  pastObservationFor,
} from '@/lib/logic/history';
import { aiSelectors } from '@/services/aiService';
import { useHistory } from '@/state/HistoryProvider';
import { useSession } from '@/state/SessionProvider';
import type {
  ApproachHint,
  CompatibilityResult,
  ConversationQuestion,
  FirstContactReport,
  HistoryReport,
  MbtiBridgeReport,
  MbtiLensReport,
  MbtiPatternReport,
  MirrorAxisKey,
  MirrorReport,
  RelationshipProfile,
  RepeatedRelationshipSignal,
  SoloMode,
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

/**
 * v1.13 — '다가가는 힌트'. Compatibility Score와 마찬가지로 순수 함수라 Target을 고치면
 * 다음 렌더에 바로 반영된다(재계산 버튼이 필요 없다, §37). MBTI/사주/출생정보는 evidence
 * source로 쓰지 않는다(§49/§50) — `target`에서 `preferences`·4축만 읽는다.
 */
export function useApproachHints(): ApproachHint[] {
  const { answers } = useSession();
  const compatibility = useCompatibility();
  return useMemo(
    () => buildApproachHints(answers.target, compatibility),
    [answers.target, compatibility],
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
 * MBTI 조합 패턴 (v1.25 P3-2)
 *
 * 무료 MBTI Lens가 보장하는 세 가지(패턴 · 러비 관찰 · 확인 질문)를 만든다.
 * **MBTI 데이터만** 쓴다 — 관계 답변은 읽지 않으므로 `useCompatibility()`에 의존하지
 * 않는다. 두 MBTI가 모두 있을 때만 값이 있다.
 */
export function useMbtiPattern(): MbtiPatternReport | null {
  const mbtiLens = useMbtiLens();
  return useMemo(() => aiSelectors.mbtiPattern(mbtiLens), [mbtiLens]);
}

/**
 * MBTI × Relationship Signal Bridge (v1.24 P3-1)
 *
 * 이미 계산된 `CompatibilityResult`와 `MbtiLensReport`를 **읽어서** 두 관점이 같은
 * 방향인지만 비교한다. 동기화율·MBTI 계산은 이 훅 때문에 다시 실행되지 않고 값도 바뀌지
 * 않는다 — 두 MBTI가 모두 있을 때만 값이 있다.
 */
export function useMbtiBridge(): MbtiBridgeReport | null {
  const result = useCompatibility();
  const mbtiLens = useMbtiLens();
  return useMemo(() => aiSelectors.mbtiBridge(mbtiLens, result), [mbtiLens, result]);
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

/**
 * Solo 분기 — 지금 이 사용자를 어떤 리포트로 보낼지 (v1.29 P4 §32~§34)
 *
 * 새 점수가 아니다. 이미 있는 `targetKnownCount`/`TARGET_MIN_KNOWN`만 읽는다.
 */
export function useSoloMode(): SoloMode {
  const { answers } = useSession();
  return useMemo(() => soloModeOf(answers), [answers]);
}

/**
 * First Contact Report (v1.29 P4)
 *
 * ⚠️ `couple`(상대를 비교할 만큼 아는 상태)에서는 만들지 않는다 — Solo 리포트가
 * 궁합 결과를 대체하지 않는다. 두 리포트가 같은 화면을 두고 다투면 사용자는
 * 자기가 무엇을 본 것인지 모른다.
 */
export function useFirstContact(): FirstContactReport | null {
  const { answers } = useSession();
  const mode = useSoloMode();
  return useMemo(() => {
    if (mode === 'couple') return null;
    return aiSelectors.firstContact({
      declared: answers.declared,
      experience: answers.experience,
      target: answers.target,
      mode,
    });
  }, [answers.declared, answers.experience, answers.target, mode]);
}

export function useMirror(): MirrorReport {
  const { answers } = useSession();
  return useMemo(
    () => aiSelectors.mirror(answers.declared, answers.experience),
    [answers.declared, answers.experience],
  );
}

/**
 * 현재 분석에 재사용할 Past Observation (§22/§23/§24).
 *
 * ⚠️ 이 값은 현재 Mirror/Compatibility **판정을 바꾸지 않는다.** Supporting Evidence로만 쓴다.
 * 현재 분석이 이미 History에 저장돼 있으면 그 항목은 과거에서 제외한다 — 자기 자신을
 * '과거의 반복'으로 세지 않기 위해서다.
 */
export function usePastObservation(axis: MirrorAxisKey | null | undefined): {
  occurrences: number;
  text: string;
} | null {
  const { answers } = useSession();
  const { entries } = useHistory();

  return useMemo(() => {
    if (!axis) return null;
    const currentAnalysisId = analysisFingerprint(
      answers.status,
      answers.declared,
      answers.experience,
    );
    const self = entries.find((entry) => entry.analysisId === currentAnalysisId);
    return pastObservationFor(entries, axis, self?.id);
  }, [axis, entries, answers.status, answers.declared, answers.experience]);
}

/** 저장된 기록에서 되풀이된 GAP/CHANGE 신호 (§21) */
export function useRepeatedSignals(): RepeatedRelationshipSignal[] {
  const { entries } = useHistory();
  return useMemo(() => findRepeatedRelationshipSignals(entries), [entries]);
}

/** 이전 기록 vs 최신 기록 변화 리포트 (F2) */
export function useHistoryReport(): HistoryReport {
  const { entries } = useHistory();
  return useMemo(() => buildHistoryReport(entries), [entries]);
}

/**
 * v1.16 — 사진이 하나도 없으면(전체 삭제) 예전 `observedAnalysis`가 남아 있어도 그 근거로
 * 삼지 않는다(Photo Revisit §4-D) — 근거 사진이 없는 관찰을 현재 결과인 것처럼 보여주지
 * 않는다. `observations`(사용자 확인/수정 기록)는 지우지 않으므로, 사진을 다시 고르고
 * 재분석하면 같은 trait id에 대한 과거 correction이 그대로 다시 살아난다.
 */
export function useRelationshipProfile(): RelationshipProfile {
  const { answers } = useSession();
  const hasPhotos = answers.photos.length > 0;
  const observedTraits = answers.observedAnalysis?.traits;
  return useMemo(() => {
    const traits = hasPhotos ? (observedTraits ?? []) : [];
    return aiSelectors.profile(traits, answers.observations, answers.declared, answers.experience);
  }, [hasPhotos, observedTraits, answers.observations, answers.declared, answers.experience]);
}

export function useHomeHighlights(): { key: string; value: string }[] {
  const { answers } = useSession();
  return useMemo(
    () => aiSelectors.homeHighlights(answers.declared, answers.experience),
    [answers.declared, answers.experience],
  );
}
