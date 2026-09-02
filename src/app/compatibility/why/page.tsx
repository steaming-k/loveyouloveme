'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import {
  AiNarrativeNotice,
  AiSourceLabel,
  useNarrativeViewEvent,
} from '@/components/ai/AiModeNotice';
import { CompatibilityAxisNarrative } from '@/components/ai/NarrativeViews';
import { NoticeBox, PageHeading, SectionLabel } from '@/components/common/primitives';
import { MbtiLensPanel } from '@/components/compatibility/MbtiLensPanel';
import { SignalCard } from '@/components/compatibility/SignalCard';
import { PastObservationNote } from '@/components/history/PastObservationNote';
import { PremiumEntryRow } from '@/components/premium/PremiumEntryRow';
import { PRIVACY } from '@/data/copy';
import { trackEvent } from '@/lib/analytics';
import { resolvePrice, resolvePriceVariant } from '@/lib/premiumVariant';
import { premiumFeatureState } from '@/services/premiumService';
import { ROUTES } from '@/lib/routes';
import { useCompatibilityNarrative, useCrossSourceInsights } from '@/hooks/useAiNarrative';
import { useCompatibility, useMbtiLens, usePastObservation } from '@/hooks/useAnalysis';

/**
 * S22 Compatibility Detail (구 Why 전체 아코디언 화면을 대체)
 *
 * 이전에는 Hero → Why → Good → Friction → Questions → Mirror Teaser를
 * 전부 거쳐야 Mirror에 닿을 수 있었다. 그건 Core Value(Mirror)까지 너무 멀다.
 *
 * 이제 이 화면 하나로 '왜 이 점수인지 · 가장 잘 맞는 신호 1개 · 가장 관찰이 필요한 신호 1개'를
 * 보여주고, 전체 목록(Good/Friction/Questions)은 '더 보기' 링크로만 연결한다.
 * 사용자가 그 세 화면을 하나도 안 봐도 하단 CTA로 바로 Mirror Teaser에 닿을 수 있어야 한다.
 */
export default function CompatibilityDetailPage() {
  const router = useRouter();
  const result = useCompatibility();
  const mbtiLens = useMbtiLens();

  /**
   * v1.7 — AI 설명은 **non-blocking**이다(§16).
   * 점수·Good/Friction 판정은 위 `useCompatibility()`에서 이미 끝났고, 이 호출이 실패하거나
   * 늦어도 화면은 그대로 렌더된다. S20에서 prefetch됐다면 캐시를 즉시 읽는다(§62).
   */
  const narrative = useCompatibilityNarrative();

  useNarrativeViewEvent({
    task: 'compatibility-narrative',
    source: 'compatibility_detail',
    status: narrative.status,
    mode: narrative.mode,
    itemCount: narrative.data?.narratives.length ?? 0,
  });

  const topGood = result.goodSignals[0];
  const topFriction = result.frictionSignals[0];
  // 가장 관찰이 필요한 축에 대해서만 과거 기록을 참고로 붙인다 (§24)
  const pastObservation = usePastObservation(topFriction?.key ?? null);

  // Premium 진입 상태. 가격은 세션에 고정된 variant를 따른다.
  const [variant] = useState(() => resolvePriceVariant());
  const crossSourceInsights = useCrossSourceInsights();
  const premiumFeature = premiumFeatureState('relationship_deep_report', resolvePrice(variant), {
    deepReportAvailable: crossSourceInsights.length > 0,
  });

  return (
    <ScreenLayout
      header={<ScreenHeader backHref={ROUTES.compatibility} title="궁합 상세" />}
      footer={
        <Button
          onClick={() => {
            trackEvent('relationship_mirror_postpone', { from: 'compatibility_detail_skip' });
            router.push(ROUTES.mirrorTeaser);
          }}
        >
          다음 관찰 보기
        </Button>
      }
      bodyClassName="pt-1.5 pb-4"
    >
      <div className="flex flex-col gap-5">
        <PageHeading
          lines={[`${result.score ?? '?'}에는 이유가 있어.`]}
          caption={`비교 가능한 ${result.comparedCount}개 신호를 기준으로 계산했어. 항목별 근거는 아래에서 볼 수 있어.`}
          size="question"
        />

        {/*
          §12 정보 위계 — AI 설명은 **관계 신호 카드 아래**에 온다.
          ① 실제 관계 신호(SignalCard: 근거 포함) → ② AI 설명 + 상황 예시
          AI 문장이 신호보다 위로 올라가면 안 된다.
        */}
        {topGood ? (
          <section className="flex flex-col gap-2.5">
            <SectionLabel className="flex items-center gap-1.5">
              가장 잘 맞는 신호
              <AiSourceLabel mode={narrative.mode} />
            </SectionLabel>
            <ul className="flex flex-col gap-2.5">
              <SignalCard dimension={topGood} variant="good" />
            </ul>
            <CompatibilityAxisNarrative
              axis={topGood.key}
              narratives={narrative.data?.narratives}
              status={narrative.status}
            />
          </section>
        ) : null}

        {topFriction ? (
          <section className="flex flex-col gap-2.5">
            <SectionLabel>가장 관찰이 필요한 신호</SectionLabel>
            <ul className="flex flex-col gap-2.5">
              <SignalCard dimension={topFriction} variant="friction" />
            </ul>
            <CompatibilityAxisNarrative
              axis={topFriction.key}
              narratives={narrative.data?.narratives}
              status={narrative.status}
            />
          </section>
        ) : null}

        {/*
          정보 위계(§25): ① 실제 관계 신호 → ② 근거/상황 → ③ Past Observation → ④ MBTI Lens.
          History도 MBTI도 실제 관계 신호보다 위에 오지 않는다. 궁합 점수에는 둘 다 미반영이다.
        */}
        {pastObservation ? (
          <section className="flex flex-col gap-2.5">
            <SectionLabel>과거 관찰 · 참고</SectionLabel>
            <PastObservationNote text={pastObservation.text} />
          </section>
        ) : null}

        {/* Supporting Lens — 반드시 실제 관계 신호·과거 관찰 뒤에 온다. */}
        {mbtiLens ? (
          <section className="flex flex-col gap-2.5">
            <SectionLabel>MBTI 렌즈 · 참고</SectionLabel>
            <MbtiLensPanel report={mbtiLens} variant="summary" />
            <button
              type="button"
              onClick={() => router.push(ROUTES.lensMbti)}
              className="flex min-h-11 items-center justify-between rounded-row border border-line bg-surface px-4 text-sub"
            >
              MBTI 관점으로 더 보기
              <span className="text-ink-faint" aria-hidden>
                →
              </span>
            </button>
          </section>
        ) : null}

        {/*
          ⑤ ENTERTAINMENT LENSES — 위계상 가장 마지막. 카드가 아니라 한 줄 진입점으로만 두어
          실제 관계 신호 카드보다 시각적으로 약하게 유지한다.
        */}
        <section className="flex flex-col gap-2">
          <SectionLabel>OTHER LENSES · 재미로 보기</SectionLabel>
          <button
            type="button"
            onClick={() => router.push(ROUTES.compatibilityLenses)}
            className="flex min-h-11 items-center justify-between gap-3 rounded-row border border-dashed border-line-strong bg-canvas-warm px-4 py-3.5 text-left"
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[12.5px] font-medium">사주 · 별자리 관점으로 우리 둘 보기</span>
              <span className="text-[11px] keep-all text-ink-faint">
                동기화율에는 반영하지 않는 참고 렌즈야
              </span>
            </span>
            <span className="flex-none text-ink-muted" aria-hidden>
              →
            </span>
          </button>
        </section>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => router.push(ROUTES.goodSignal)}
            className="flex min-h-11 items-center justify-between rounded-row border border-line bg-surface px-4 text-sub"
          >
            잘 맞는 신호 모두 보기
            <span className="text-ink-faint" aria-hidden>
              →
            </span>
          </button>
          <button
            type="button"
            onClick={() => router.push(ROUTES.frictionSignal)}
            className="flex min-h-11 items-center justify-between rounded-row border border-line bg-surface px-4 text-sub"
          >
            관찰이 필요한 신호 모두 보기
            <span className="text-ink-faint" aria-hidden>
              →
            </span>
          </button>
          <button
            type="button"
            onClick={() => router.push(ROUTES.questions)}
            className="flex min-h-11 items-center justify-between rounded-row border border-line bg-surface px-4 text-sub"
          >
            이야기해볼 질문
            <span className="text-ink-faint" aria-hidden>
              →
            </span>
          </button>
        </div>

        {/*
          ⑥ PREMIUM DETAIL — 위계상 가장 마지막, Secondary.
          Sticky Primary CTA는 여전히 '다음 관찰 보기'(→ Mirror)다. Premium이 Mirror Funnel보다
          강해지면 안 된다(§33 Guardrail).
        */}
        <PremiumEntryRow feature={premiumFeature} source="compatibility" />

        {/* AI 설명이 없는 이유를 숨기지 않는다. demo에서는 아무 말도 하지 않는다(§64) */}
        <AiNarrativeNotice
          task="compatibility-narrative"
          status={narrative.status}
          reason={narrative.reason}
        />
        <NoticeBox>{PRIVACY.unknownExcluded}</NoticeBox>
      </div>
    </ScreenLayout>
  );
}
