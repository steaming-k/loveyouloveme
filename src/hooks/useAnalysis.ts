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
import {
  buildObservedHistoryReport,
  buildSoloHistoryReport,
  currentObservedCategories,
  type ObservedHistoryReport,
  type SoloHistoryReport,
} from '@/lib/logic/soloHistory';
import { aiSelectors } from '@/services/aiService';
import { useHistory } from '@/state/HistoryProvider';
import {
  relationshipTenseOf,
  resolveRelationshipContext,
} from '@/lib/logic/relationshipStage';
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
  MbtiSelfLens,
  MirrorAxisKey,
  MirrorReport,
  RelationshipHistoryEntry,
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

/**
 * 자기 MBTI만으로 만드는 Self Lens (v1.14 · Self First).
 *
 * v1.32 P4-D — Premium 연결(⑦)과 근거 해석(`mbti_lens` ref)이 **상대 없이도** 되게
 * 하려면 이 값이 필요하다. 새 계산이 아니다 — 기존 `buildMbtiSelfLens`를 그대로 부른다.
 */
export function useMbtiSelfLens(): MbtiSelfLens | null {
  const { answers } = useSession();
  return useMemo(() => aiSelectors.mbtiSelfLens(answers.mbti), [answers.mbti]);
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
  const { answers } = useSession();
  const result = useCompatibility();
  const mbtiLens = useMbtiLens();
  /**
   * UT-1 P1-B §3 — 질문 variant 선택에 쓰는 맥락. **판정을 여기서 만들지 않는다** —
   * 화면들이 이미 쓰는 `resolveRelationshipContext(answers).job`과 같은 값이다.
   */
  const job = resolveRelationshipContext(answers).job;
  return useMemo(
    () => [
      ...aiSelectors.conversationQuestions(result, {
        job,
        declared: answers.declared,
        target: answers.target,
        currentSignals: answers.currentRelationship,
      }),
      ...aiSelectors.mbtiQuestions(mbtiLens),
    ],
    [result, mbtiLens, job, answers.declared, answers.target, answers.currentRelationship],
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
  /**
   * v1.41 — **memo 밖에서 계산한다.** 안에서 `resolveRelationshipContext(answers)`를
   * 부르면 memo가 `answers` 전체에 의존하게 되고, deps에는 일부 필드만 적혀 있어서
   * 값이 낡을 수 있다(eslint가 정확히 이걸 경고했다). `tense`는 두 값짜리 문자열이라
   * deps로 쓰면 참조 비교 문제도 없다.
   */
  const tense = relationshipTenseOf(resolveRelationshipContext(answers).job);
  return useMemo(
    () =>
      aiSelectors.mirror(answers.declared, answers.experience, answers.currentRelationship, tense),
    [answers.declared, answers.experience, answers.currentRelationship, tense],
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

/** 이전 기록 vs 최신 기록 변화 리포트 (F2) — **커플 기록만** 본다 */
export function useHistoryReport(): HistoryReport {
  const { entries } = useHistory();
  return useMemo(() => buildHistoryReport(entries), [entries]);
}

/**
 * 커플 변화 비교에 **실제로 참여한 두 기록** (v1.35 · §10)
 *
 * ⚠️ 화면이 `useHistory().latest`/`previous`를 쓰면 안 된다. 그 값은 audience를 가리지
 * 않아서, Solo 관찰이 마지막에 저장돼 있으면 화면에 적힌 날짜와 실제로 비교한 기록이
 * 어긋난다(Mixed History 실측 버그). 근거·캡션은 전부 이 값을 기준으로 만든다.
 */
export function useComparedHistoryEntries(): {
  previous: RelationshipHistoryEntry | null;
  latest: RelationshipHistoryEntry | null;
} {
  const { entries } = useHistory();
  const report = useHistoryReport();
  return useMemo(() => {
    const find = (id: string | null) =>
      id ? (entries.find((entry) => entry.id === id) ?? null) : null;
    return { previous: find(report.compared.previousId), latest: find(report.compared.latestId) };
  }, [entries, report.compared.previousId, report.compared.latestId]);
}

/**
 * Solo 시간축 비교 — 저장된 Solo snapshot vs **지금 답** (v1.34 · v1.35에서 훅으로 승격)
 *
 * ⚠️ `useHistoryReport`(커플)와 주어도 시점도 다르다. 섞어 쓰지 않는다.
 *
 *   CURRENT   `useFirstContact()` — 지금 답으로 매번 다시 계산
 *   HISTORY   저장된 snapshot — 그때의 값을 그대로 얼려둔 것
 *   CHANGE    이 훅
 *
 * ⚠️ 화면에서 계산하지 않는다. 예전에는 `/first-contact`가 직접
 * `buildSoloHistoryReport`를 부르면서 `report ?? { available: false } as never`로
 * 타입을 우회했다 — 같은 계산이 다른 화면에 필요해지는 순간 그 우회가 복사된다.
 */
export function useSoloHistoryReport(): SoloHistoryReport {
  const { entries } = useHistory();
  const current = useFirstContact();
  return useMemo(
    () => buildSoloHistoryReport({ entries, current }),
    [entries, current],
  );
}

/**
 * Observed 시간축 비교 — 저장된 활동 범주 vs 지금 사진 (v1.35 · §5 ~ §8)
 *
 * ⚠️ 사진은 **선택 source**다. 사진이 없으면 `comparable === false`이고, 그건
 * '장면이 사라졌다'가 아니라 '이번엔 비교할 사진이 없다'다(§29).
 */
export function useObservedHistoryReport(): ObservedHistoryReport {
  const { answers } = useSession();
  const { entries } = useHistory();
  const current = useMemo(() => currentObservedCategories(answers), [answers]);
  return useMemo(() => buildObservedHistoryReport({ entries, current }), [entries, current]);
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
  const tense = relationshipTenseOf(resolveRelationshipContext(answers).job);
  return useMemo(
    () =>
      aiSelectors.homeHighlights(
        answers.declared,
        answers.experience,
        answers.currentRelationship,
        tense,
      ),
    [answers.declared, answers.experience, answers.currentRelationship, tense],
  );
}
