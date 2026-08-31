'use client';

import { UtRatingCard } from '@/components/ut/UtRatingCard';
import { SectionLabel } from '@/components/common/primitives';
import { UT_MODE } from '@/lib/env';
import { useSession } from '@/state/SessionProvider';

/**
 * UT 종료 카드 (v1.7 · §46 · §47 · §97)
 *
 * Core Flow가 끝난 지점(F3 저장 직후)에서 남은 두 질문만 묻는다.
 *
 * ⚠️ **점수를 합산해서 사용자에게 보여주지 않는다**(§97). 연구용 수집 UI다.
 * ⚠️ 사진을 넣지 않은 사용자에게 사진 가치를 묻지 않는다(§47) — 답할 수 없는 질문이다.
 */
export function UtSummaryCard() {
  const { answers } = useSession();

  if (!UT_MODE) return null;

  const analysis = answers.observedAnalysis;
  const photoCount = analysis?.evidenceCoverage.imageCount ?? 0;
  const usableEvidence = analysis?.evidenceCoverage.usableImageCount ?? 0;

  /**
   * §51 — '사진이 진짜 필요한가'를 비교할 수 있게 photo_used를 함께 보낸다.
   * 사진을 넣은 그룹(A) vs 넣지 않은 그룹(B)을 나눠 보기 위한 property다.
   *
   * ⚠️ 표본이 적으면 유의하다고 주장하지 않는다 — 문서에도 그렇게 적었다.
   */
  const photoUsed = photoCount > 0;

  return (
    <section className="flex w-full flex-col gap-2.5">
      <SectionLabel>UT · 연구용 문항</SectionLabel>

      <UtRatingCard
        question="이 결과가 연애할 때의 나를 이해하는 데 도움이 됐어?"
        event="ut_self_understanding_helpfulness"
        properties={{ task: 'relationship', photo_used: photoUsed }}
        lowLabel="전혀 아니야"
        highLabel="많이 도움됐어"
      />

      {photoUsed ? (
        <UtRatingCard
          question="사진을 넣은 게 분석이 더 나답게 느껴지는 데 도움이 됐어?"
          event="ut_photo_value_rate"
          properties={{
            task: 'observed',
            photo_count: photoCount,
            usable_evidence_count: usableEvidence,
            mode: analysis?.meta.mode ?? 'none',
          }}
          lowLabel="전혀 아니야"
          highLabel="많이 도움됐어"
        />
      ) : null}

      <p className="px-1 text-[10.5px] keep-all leading-relaxed text-ink-faint">
        이 문항들은 연구용이고, 답한 점수는 분석 결과에 반영되지 않아.
      </p>
    </section>
  );
}
