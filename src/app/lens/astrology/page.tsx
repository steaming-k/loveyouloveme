'use client';

import { useUtMode } from '@/hooks/useUtMode';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/common/Button';
import { HydrationGate } from '@/components/common/HydrationGate';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { PageHeading, SectionLabel, Tag } from '@/components/common/primitives';
import {
  BirthMissingBlock,
  BirthSummaryRows,
  ConversationPromptList,
  EntertainmentNotice,
  LimitationList,
} from '@/components/lens/LensStateBlocks';
import { LensCoreBridge } from '@/components/lens/LensCoreBridge';
import { LensObservationIntro } from '@/components/lens/LensObservationIntro';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { PremiumBundleCard } from '@/components/premium/PremiumBundleCard';
import { PremiumEntryRow } from '@/components/premium/PremiumEntryRow';
import { ASTROLOGY_COPY } from '@/data/copy';
import { ZODIAC_NOTES } from '@/data/zodiac';
import { trackEvent } from '@/lib/analytics';
import { resolvePrice, resolvePriceVariant } from '@/lib/premiumVariant';
import { hasPreviewUnlock } from '@/lib/premiumAccess';
import { premiumFeatureState } from '@/services/premiumService';
import { lensAvailability } from '@/lib/logic/birth';
import { hasPremiumEvidence } from '@/lib/logic/premiumChapters';
import { soloModeOf } from '@/lib/logic/soloMode';
import { useCrossSourceInsights } from '@/hooks/useAiNarrative';
import { useMirror } from '@/hooks/useAnalysis';
import { RESULT_ANCHORS, ROUTES } from '@/lib/routes';
import {
  buildAstrologyCompatibility,
  buildAstrologySelfLens,
} from '@/services/astrologyService';
import {
  jobAllowsOutwardAction,
  resolveRelationshipContext,
} from '@/lib/logic/relationshipStage';
import { useSession } from '@/state/SessionProvider';

/**
 * X1-b Astrology Lens — Entertainment
 *
 * v1.4에서 '12개 중 직접 고르기' → **생년월일 기반 Simple Sun Sign**으로 바뀌었다.
 * 동기화율·Relationship Mirror·History 계산에는 어디에도 관여하지 않는다.
 * 점수·확률·'천생연분/상극'을 만들지 않고, 비슷/다름과 대화 주제만 보여준다.
 */
export default function AstrologyLensPage() {
  return (
    <HydrationGate>
      <AstrologyLensView />
    </HydrationGate>
  );
}

function AstrologyLensView() {
  const router = useRouter();
  const { answers } = useSession();
  const [today] = useState(() => new Date());
  const [variant] = useState(() => resolvePriceVariant());
  /** v1.47 — UT에서는 Premium 표면이 flag와 무관하게 열린다(`resolvePremiumAccess`) */
  const utMode = useUtMode();

  const mine = answers.birthProfile;
  const theirs = answers.target.birthProfile;
  const availability = lensAvailability(mine, theirs, today);
  /**
   * v1.46 PremiumLens §2 — Bundle 자격 판정. **새 기준을 만들지 않고** 결과
   * 화면·Home과 같은 `hasPremiumEvidence`를 그대로 부른다.
   */
  const crossSourceInsights = useCrossSourceInsights();
  const mirror = useMirror();

  /*
    v1.40.1 §38.3 — 필수 파라미터. 하드코딩하지 않고 실제 Job에서 도출한다.
    1차 UT 전체 Backlog P0-2 — 상태를 두 번 읽으므로 JSX 안에서 만들지 않는다.
  */
  const premiumBundleFeature = premiumFeatureState(
    'relationship_deep_report',
    resolvePrice(variant),
    {
      utMode,
      allowsOutwardAction: jobAllowsOutwardAction(resolveRelationshipContext(answers).job),
      deepReportAvailable: hasPremiumEvidence({
        insights: crossSourceInsights,
        declared: answers.declared,
        mirror,
      }),
      solo: soloModeOf(answers) === 'no_target',
    },
  );
  /** CTA 문구만 바꾼다('열기' ↔ '보기'). 접근 권한 자체는 Paywall이 판단한다 */
  const bundleUnlocked = hasPreviewUnlock(
    'relationship_deep_report',
    answers.currentAnalysisMeta?.funnelAnalysisId ?? null,
  );

  const self = useMemo(() => buildAstrologySelfLens(mine, today), [mine, today]);
  // getSunSign 기반 계산을 self/target에 대칭적으로 적용한다 — TARGET도 단독 Result를 가진다(§9/§10)
  const targetSelf = useMemo(() => buildAstrologySelfLens(theirs, today), [theirs, today]);
  const couple = useMemo(
    () => buildAstrologyCompatibility(mine, theirs, today),
    [mine, theirs, today],
  );

  useEffect(() => {
    trackEvent('astrology_lens_view', {
      mode: availability.couple ? 'compatibility' : 'self',
      has_self: availability.self,
      has_target: targetSelf.available,
    });
  }, [availability.couple, availability.self, targetSelf.available]);

  const mergedLimitations = useMemo(
    () => [
      ...new Set([
        ...self.limitations,
        ...(availability.self ? targetSelf.limitations : []),
        ...(availability.couple ? couple.limitations : []),
      ]),
    ],
    [self.limitations, targetSelf.limitations, couple.limitations, availability.self, availability.couple],
  );

  return (
    <ScreenLayout
      header={
        <ScreenHeader
          backHref={ROUTES.lens}
          action={<Tag tone="neutral">{ASTROLOGY_COPY.badge}</Tag>}
        />
      }
      footer={
        <Button variant="secondary" onClick={() => router.push(ROUTES.lens)}>
          렌즈 목록으로
        </Button>
      }
      bodyClassName="pt-1.5 pb-4"
    >
      <div className="flex flex-col gap-5">
        <PageHeading lines={ASTROLOGY_COPY.title} caption={ASTROLOGY_COPY.caption} />

        {/*
          Concept Continuity 260915 — 앞 화면까지 이어지던 러비의 관찰을 여기서 끊지 않는다.
          Premium 리포트의 렌즈 섹션에는 이미 같은 뜻의 문장이 있는데(`LENS_SECTION_COPY.intro`)
          단독 렌즈 화면에만 없어서, 일반 운세 앱의 결과 페이지처럼 시작했다.
        */}
        {availability.self ? <LensObservationIntro lens="별자리" /> : null}

        {/* 내 정보조차 없으면 여기서 멈춘다 — 없는 결과를 만들지 않는다 */}
        {!availability.self ? (
          <BirthMissingBlock
            lens="astrology"
            missing={availability.missing === 'both' ? 'both' : 'self'}
          />
        ) : null}

        {/* Self Lens */}
        {self.available && self.sunSign ? (
          <section className="flex flex-col gap-2.5">
            <SectionLabel>{ASTROLOGY_COPY.selfLabel}</SectionLabel>
            <div className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4">
              <p className="text-[10.5px] font-semibold tracking-[0.06em] text-ink-muted">
                SUN SIGN
              </p>
              <p className="text-[21px] font-semibold tracking-[-0.5px]">{self.sunSignLabel}</p>
              <p className="text-caption keep-all leading-relaxed text-ink-sub">{self.trait}</p>
            </div>
          </section>
        ) : null}

        {/* Target Lens — 상대 정보가 있으면 Couple 여부와 무관하게 단독으로도 보여준다(§9/§10) */}
        {availability.self && targetSelf.available && targetSelf.sunSign ? (
          <section className="flex flex-col gap-2.5">
            <SectionLabel>{ASTROLOGY_COPY.targetLabel}</SectionLabel>
            <div className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4">
              <p className="text-[10.5px] font-semibold tracking-[0.06em] text-ink-muted">
                SUN SIGN
              </p>
              <p className="text-[21px] font-semibold tracking-[-0.5px]">
                {targetSelf.sunSignLabel}
              </p>
              <p className="text-caption keep-all leading-relaxed text-ink-sub">
                {targetSelf.trait}
              </p>
            </div>
          </section>
        ) : null}

        {/* Couple Lens — 둘 다 있어야만 만든다 */}
        {couple.available && couple.mine && couple.theirs ? (
          <section className="flex flex-col gap-3">
            <SectionLabel>우리 둘</SectionLabel>

            <div className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface p-4">
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold tracking-[0.05em] text-ink-muted">나</p>
                <p className="text-body font-semibold">{couple.mine.label}</p>
              </div>
              <span className="flex-none text-[13px] text-ink-faint" aria-hidden>
                ×
              </span>
              <div className="min-w-0 text-right">
                <p className="text-[10.5px] font-semibold tracking-[0.05em] text-ink-muted">상대</p>
                <p className="text-body font-semibold">{couple.theirs.label}</p>
              </div>
            </div>

            {couple.similar.length > 0 ? (
              <div className="flex flex-col gap-1.5 rounded-card border border-line bg-surface p-4">
                <p className="text-[10px] font-semibold tracking-[0.06em] text-mint-text">
                  {ASTROLOGY_COPY.similarLabel}
                </p>
                {couple.similar.map((line) => (
                  <p key={line} className="text-[12.5px] keep-all leading-relaxed text-[#555]">
                    {line}
                  </p>
                ))}
              </div>
            ) : null}

            {couple.different.length > 0 ? (
              <div className="flex flex-col gap-1.5 rounded-card border border-line bg-surface p-4">
                <p className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
                  {ASTROLOGY_COPY.differentLabel}
                </p>
                {couple.different.map((line) => (
                  <p key={line} className="text-[12.5px] keep-all leading-relaxed text-[#555]">
                    {line}
                  </p>
                ))}
              </div>
            ) : null}

            <ConversationPromptList lens="astrology" prompts={couple.prompts} />
          </section>
        ) : availability.self && !availability.couple ? (
          <>
            <ConversationPromptList lens="astrology" prompts={self.prompts} />
            <BirthMissingBlock lens="astrology" missing="target" />
          </>
        ) : null}

        <BirthSummaryRows mine={mine} theirs={theirs} />

        {/*
          Couple 결과가 있어도 Self 쪽 한계(경계일 경고·출생시간 없음)를 숨기지 않는다 —
          그 한계는 두 사람 결과에도 그대로 남아 있기 때문이다. 중복만 걸러서 합친다.
        */}
        <LimitationList items={mergedLimitations} />

        {/* v1.3에서 직접 고른 별자리가 있으면, 계산값과 다를 수 있다는 사실만 알린다 */}
        {answers.legacyZodiac && !self.available ? (
          <EntertainmentNotice>
            예전에 직접 고른 별자리({ZODIAC_NOTES[answers.legacyZodiac].label})가 남아 있어. 이제는
            생년월일로 계산하니까, 위에 생년월일을 넣어주면 다시 볼 수 있어.
          </EntertainmentNotice>
        ) : null}

        {/*
          Natal Chart를 가짜로 만들지 않으므로, 상세도 현재 구현 가능한 범위만 제안한다(§20)

          ══ 1차 UT 전체 Backlog P0-2 — **렌즈 화면은 자기 가격을 갖지 않는다** ══════

          v1.46 §35가 세 렌즈의 결제 대상을 하나로 모았지만, 여기 있던 `PremiumEntryRow`는
          **자기 가격 줄**을 갖는다. 그래서 렌즈를 셋 다 둘러본 사용자(0911 UT 참가자가
          실제로 밟은 경로)에게는 ₩1,900이 세 번 찍혔고, 그건 세 개의 상품으로 읽힌다.

          보조 문구 한 줄로 푸는 문제가 아니라 **정보 구조**의 문제였다. Home이 이미 옹게
          갖고 있던 Bundle 카드를 그대로 쓴다 — 가격은 헤더에 하나, 그 아래는 그 가격에
          포함된 렌즈 목록이고, 렌즈 행에는 가격을 넣을 자리 자체가 마크업에 없다.

          ⚠️ `unavailable`은 Bundle로 바꾸지 않는다. 그 상태의 `PremiumEntryRow`는
          **가격도 CTA도 붙이지 않고**(§40) 대신 보완 경로 버튼을 준다 — 없는 것을 팔지
          않으면서 dead-end도 만들지 않는 자리라 그대로 둔다.
        */}
        {premiumBundleFeature.status === 'unavailable' && !utMode ? (
          <PremiumEntryRow feature={premiumBundleFeature} source="astrology" />
        ) : (
          <PremiumBundleCard
            feature={premiumBundleFeature}
            unlocked={bundleUnlocked}
            source="astrology"
            hookVariant="lens_bundle"
            currentLens="zodiac"
          />
        )}


        {/*
          Concept Continuity 260915 — 렌즈에서 끝내지 않고 **Core 관계 신호로 되돌린다.**

          MBTI 렌즈는 이미 `LENS → CORE`로 돌아가는 길이 있었는데(v1.24 §12) 사주·별자리에는
          없어서, 이 두 화면만 '보고 끝'으로 닫혔다. 같은 컴포넌트를 그대로 쓴다 — 새 카피도
          새 분기도 만들지 않는다. 노트 문장('이 렌즈에서는 이렇게 보여. 그런데 실제 관계에서는
          어떨까?')이 렌즈 이름을 말하지 않아 세 화면에서 그대로 성립한다.

          ⚠️ 궁합 결과가 아직 없으면 돌아갈 곳이 없으므로 그리지 않는다(MBTI와 같은 조건).
        */}
        {availability.self && answers.completed.compatibility ? (
          <LensCoreBridge
            className="mt-2"
            href={`${ROUTES.compatibility}#${RESULT_ANCHORS.compatibilityGood}`}
          />
        ) : null}

        <LovyMessage pose="crystal" size={52}>
          {ASTROLOGY_COPY.disclaimer}
        </LovyMessage>

        <EntertainmentNotice>
          재미로 보는 참고 렌즈야. 동기화율·Relationship Mirror·관찰 기록에는 반영하지 않아.
        </EntertainmentNotice>
      </div>
    </ScreenLayout>
  );
}
