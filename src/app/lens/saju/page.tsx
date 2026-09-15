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
  EntertainmentNotice,
  LensReportEyebrow,
  LimitationList,
} from '@/components/lens/LensStateBlocks';
import { LensCoreBridge } from '@/components/lens/LensCoreBridge';
import { LensObservationIntro } from '@/components/lens/LensObservationIntro';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { PremiumBundleCard } from '@/components/premium/PremiumBundleCard';
import { PremiumEntryRow } from '@/components/premium/PremiumEntryRow';
import { SAJU_COPY } from '@/data/copy';
import { LENS_UNAVAILABLE_REASON } from '@/data/premiumLens';
import {
  DAY_STEM_ELEMENT_SELF,
  ELEMENT_LABEL_KO,
  ELEMENT_RELATION_NOTE,
  SAJU_SCOPE_NOTE,
} from '@/data/saju';
import { useCrossSourceInsights } from '@/hooks/useAiNarrative';
import { useMirror } from '@/hooks/useAnalysis';
import { trackEvent } from '@/lib/analytics';
import { lensAvailability } from '@/lib/logic/birth';
import { hasPremiumEvidence } from '@/lib/logic/premiumChapters';
import {
  jobAllowsOutwardAction,
  resolveRelationshipContext,
} from '@/lib/logic/relationshipStage';
import {
  elementRelation,
  isLunarBlocked,
  readSajuDay,
  type DayPillar,
} from '@/lib/logic/sajuPillars';
import { soloModeOf } from '@/lib/logic/soloMode';
import { resolvePrice, resolvePriceVariant } from '@/lib/premiumVariant';
import { RESULT_ANCHORS, ROUTES } from '@/lib/routes';
import { hasPreviewUnlock } from '@/lib/premiumAccess';
import { premiumFeatureState } from '@/services/premiumService';
import { useSession } from '@/state/SessionProvider';

/**
 * X1-c 사주 Lens — Entertainment
 *
 * ══ 260914 UT 후속 P0 — 'DEMO · 계산 엔진 미연결' 회귀 ═══════════════════════
 *
 * v1.46이 일주 계산 엔진(`logic/sajuPillars.ts`)을 붙였지만 **Premium 렌즈에만** 연결했고,
 * 이 화면은 v1.4의 `services/sajuService.ts`(`SAJU_ENGINE_READY=false` 스텁)를 계속 불렀다.
 * 그래서 계산이 실제로 되는 사용자에게도 'DEMO · 계산 엔진 미연결'이 보였다 — env/Provider
 * 문제가 아니라 **낡은 코드 경로** 문제였다.
 *
 * 이제 Premium 렌즈와 같은 엔진(`readSajuDay`)을 쓴다. 판정·계산을 이 화면에서 복제하지 않는다.
 *
 * ⚠️ FREE / Premium 경계. 이 화면이 보여주는 것은 **일주 값 + 한 줄 해석 + 질문 하나**다.
 * 일간 음양 비교 · 어긋나기 쉬운 지점 · 사건 연결 · Cross-Lens는 Premium 번들에만 있다
 * (`buildPremiumLensBundle`) — 여기서 그 번들을 만들지 않는다.
 */
export default function SajuLensPage() {
  return (
    <HydrationGate>
      <SajuLensView />
    </HydrationGate>
  );
}

function pillarText(pillar: DayPillar): string {
  return `${pillar.label}(${pillar.hanja})일`;
}

function SajuLensView() {
  const router = useRouter();
  const { answers } = useSession();
  const [today] = useState(() => new Date());
  const [variant] = useState(() => resolvePriceVariant());
  /** v1.47 — UT에서는 Premium 표면이 flag와 무관하게 열린다(`resolvePremiumAccess`) */
  const utMode = useUtMode();
  const crossSourceInsights = useCrossSourceInsights();
  const mirror = useMirror();

  const mine = answers.birthProfile;
  const theirs = answers.target.birthProfile;
  const availability = lensAvailability(mine, theirs, today);

  const mineSaju = useMemo(() => readSajuDay(mine, today), [mine, today]);
  const theirsSaju = useMemo(() => readSajuDay(theirs, today), [theirs, today]);

  /*
    v1.46 PremiumLens §2 · §35 — 개별 렌즈 상세를 팔지 않는다. 별자리 · MBTI 화면과
    같은 Bundle을 가리키고, `source`로만 지불 의향이 어디서 생겼는지 구분한다.
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
  const lunarBlocked = isLunarBlocked(mine, today);
  const relationNote =
    mineSaju && theirsSaju
      ? ELEMENT_RELATION_NOTE[
          elementRelation(mineSaju.pillar.stemElement, theirsSaju.pillar.stemElement)
        ]
      : null;

  useEffect(() => {
    trackEvent('saju_lens_view', {
      mode: relationNote ? 'compatibility' : 'self',
      pillar_available: Boolean(mineSaju),
      has_self: availability.self,
      has_target: availability.couple || availability.missing === 'self',
    });
  }, [relationNote, mineSaju, availability.couple, availability.self, availability.missing]);

  const limitations = useMemo(
    () => [
      ...new Set([
        ...(lunarBlocked ? [LENS_UNAVAILABLE_REASON.sajuLunar] : []),
        ...(mineSaju ? [SAJU_SCOPE_NOTE, ...mineSaju.limitations] : []),
        ...(theirsSaju ? theirsSaju.limitations : []),
      ]),
    ],
    [lunarBlocked, mineSaju, theirsSaju],
  );

  return (
    <ScreenLayout
      header={
        <ScreenHeader backHref={ROUTES.lens} action={<Tag tone="neutral">{SAJU_COPY.badge}</Tag>} />
      }
      footer={
        <Button variant="secondary" onClick={() => router.push(ROUTES.lens)}>
          렌즈 목록으로
        </Button>
      }
      bodyClassName="pt-1.5 pb-4"
    >
      <div className="flex flex-col gap-5">
        {/*
          ══ LENS INFORMATION HIERARCHY 260916 §9 · §10 ═══════════════════════

          예전 첫 화면은 `ENTERTAINMENT` → `사주 렌즈` → `나의 일주 · 신축(辛丑)일`(21px)
          순서였다. 393×852 실측에서 첫 viewport의 가장 큰 활자 두 개가 **렌즈 이름과 내
          일주**였고, 관계 해석은 617px 아래에 있었다 — 럽유럽미가 아니라 사주 앱의 결과
          페이지로 읽히는 구조였다.

          그래서 제목의 **주어를 렌즈에서 두 사람으로 옮긴다.** MBTI 렌즈가 이미 쓰고 있던
          문법(`러비 관찰 기록 · 렌즈` + `성향 렌즈로 본 두 사람`)을 그대로 따른다 — 세
          렌즈가 같은 문법을 쓰게 하는 것이 목적이지 사주 화면을 더 사주답게 만드는 것이
          아니다.

          ⚠️ 상대 일주가 없으면 `두 사람`이라고 말하지 않는다(`relationNote`는 두 일주가
             모두 계산됐을 때만 생긴다) — 없는 것을 봤다고 말하지 않는 규칙이 제목에도
             그대로 적용된다.
          ⚠️ `ENTERTAINMENT` 배지는 헤더에 그대로 둔다. 지우는 것이 아니라 **한 층
             아래로** 내리는 것이 이번 작업이다.
        */}
        <PageHeading
          lines={relationNote ? SAJU_COPY.coupleTitle : SAJU_COPY.title}
          caption={SAJU_COPY.caption}
          eyebrow={<LensReportEyebrow />}
        />

        {/*
          Concept Continuity 260915 — 앞 화면까지 이어지던 러비의 관찰을 여기서 끊지 않는다.
          Premium 리포트의 렌즈 섹션에는 이미 같은 뜻의 문장이 있는데(`LENS_SECTION_COPY.intro`)
          단독 렌즈 화면에만 없어서, 일반 운세 앱의 결과 페이지처럼 시작했다.
        */}
        {mineSaju ? <LensObservationIntro lens="사주" /> : null}

        {!availability.self ? (
          <BirthMissingBlock lens="saju" missing={availability.missing === 'both' ? 'both' : 'self'} />
        ) : null}

        {mineSaju && theirsSaju && relationNote ? (
          <section className="flex flex-col gap-3">
            <SectionLabel>{SAJU_COPY.coupleLabel}</SectionLabel>

            <div className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface p-4">
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold tracking-[0.05em] text-ink-muted">나</p>
                <p className="text-body font-semibold">{pillarText(mineSaju.pillar)}</p>
              </div>
              <span className="flex-none text-[13px] text-ink-faint" aria-hidden>
                ×
              </span>
              <div className="min-w-0 text-right">
                <p className="text-[10.5px] font-semibold tracking-[0.05em] text-ink-muted">상대</p>
                <p className="text-body font-semibold">{pillarText(theirsSaju.pillar)}</p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 rounded-card border border-line bg-surface p-4">
              <p className="text-[10px] font-semibold tracking-[0.06em] text-mint-text">
                {SAJU_COPY.readingLabel}
              </p>
              <p className="text-[12.5px] keep-all leading-relaxed text-[#555]">
                {relationNote.reading}
              </p>
            </div>

            <LovyMessage pose="question" size={44}>
              {relationNote.question}
            </LovyMessage>
          </section>
        ) : null}

        {/*
          ══ LENS INFORMATION HIERARCHY 260916 §13 · §14 — **삭제가 아니라 강등** ══

          '나의 일주'는 이 렌즈가 딛고 선 근거라서 없애지 않는다. 바꾸는 것은 **역할**이다:
          관계 해석 위에서 21px로 먼저 읽히던 Main Result가, 관계 해석 아래에서 15px
          보조 카드(`이 렌즈의 기준`)로 읽힌다.

          사용자가 먼저 갖게 될 문장이 '나는 신축일주구나'가 아니라 '이 관계를 보려고
          이런 사주 값을 참고하는구나'가 되게 하는 것이 전부다.

          ⚠️ 값 · 해석 문장은 한 글자도 바꾸지 않는다(`readSajuDay` 결과 그대로).
             `DAY PILLAR` 영문 라벨만 뺐다 — 바로 위 '나의 일주'가 같은 말을 한다.
        */}
        {mineSaju ? (
          <section className="flex flex-col gap-2.5">
            <SectionLabel>{SAJU_COPY.basisLabel}</SectionLabel>
            <div className="flex flex-col gap-1.5 rounded-card border border-line-soft bg-canvas-warm p-4">
              <p className="text-[10.5px] font-semibold tracking-[0.06em] text-ink-muted">
                {SAJU_COPY.selfLabel}
              </p>
              <p className="text-[15px] font-semibold tracking-[-0.2px]">
                {pillarText(mineSaju.pillar)}
              </p>
              <p className="text-caption keep-all leading-relaxed text-ink-sub">
                일간 {ELEMENT_LABEL_KO[mineSaju.pillar.stemElement]} ·{' '}
                {DAY_STEM_ELEMENT_SELF[mineSaju.pillar.stemElement]}
              </p>
            </div>
          </section>
        ) : null}

        {availability.self && !theirsSaju ? <BirthMissingBlock lens="saju" missing="target" /> : null}

        <BirthSummaryRows mine={mine} theirs={theirs} />

        <LimitationList items={limitations} />

        {/*
          Concept Continuity 260915 — 렌즈에서 끝내지 않고 **Core 관계 신호로 되돌린다.**

          MBTI 렌즈는 이미 `LENS → CORE`로 돌아가는 길이 있었는데(v1.24 §12) 사주·별자리에는
          없어서, 이 두 화면만 '보고 끝'으로 닫혔다. 같은 컴포넌트를 그대로 쓴다 — 새 카피도
          새 분기도 만들지 않는다. 노트 문장('이 렌즈에서는 이렇게 보여. 그런데 실제 관계에서는
          어떨까?')이 렌즈 이름을 말하지 않아 세 화면에서 그대로 성립한다.

          ⚠️ 궁합 결과가 아직 없으면 돌아갈 곳이 없으므로 그리지 않는다(MBTI와 같은 조건).

          ══ LENS INFORMATION HIERARCHY 260916 §19 — **Bundle 앞으로 올렸다** ══════

          예전에는 Premium Bundle 카드 뒤에 있어서, 렌즈의 결론이 '실제 관계로 돌아가기'가
          아니라 '결제 카드 다음에 붙은 또 하나의 CTA'로 읽혔다. MBTI 렌즈는 이미
          Surprise 직후에 이 길을 두고 있다(v1.38) — 같은 자리로 맞춘다.

          ⚠️ Bundle을 없애거나 가격 · 상품 구조를 바꾸지 않는다. 순서만 바뀐다.
        */}
        {mineSaju && answers.completed.compatibility ? (
          <LensCoreBridge
            className="mt-2"
            href={`${ROUTES.compatibility}#${RESULT_ANCHORS.compatibilityGood}`}
          />
        ) : null}

        {/*
          ══ 1차 UT 전체 Backlog P0-2 — **렌즈 화면은 자기 가격을 갖지 않는다** ══════

          예전에는 여기에 `PremiumEntryRow`가 있었고, 그 행은 **자기 가격 줄**을 갖는다.
          렌즈를 셋 다 둘러본 사용자(0911 UT 참가자가 실제로 밟은 경로)에게는 ₩1,900이
          세 번 찍혔고, 그건 세 개의 상품으로 읽힌다.

          보조 문구 한 줄로 푸는 문제가 아니라 **정보 구조**의 문제였다. 그래서 Home이
          이미 옳게 갖고 있던 Bundle 카드를 그대로 쓴다 — 가격은 헤더에 하나, 그 아래는
          그 가격에 포함된 렌즈 목록이고, 렌즈 행에는 가격을 넣을 자리 자체가 마크업에
          없다(§35).

          ⚠️ `unavailable`은 Bundle로 바꾸지 않는다. 그 상태의 `PremiumEntryRow`는
          **가격도 CTA도 붙이지 않고**(§40) 대신 보완 경로 버튼을 준다 — 없는 것을 팔지
          않으면서 dead-end도 만들지 않는 자리라 그대로 둔다.
        */}
        {mineSaju ? (
          premiumBundleFeature.status === 'unavailable' && !utMode ? (
            <PremiumEntryRow feature={premiumBundleFeature} source="saju" />
          ) : (
            <PremiumBundleCard
              feature={premiumBundleFeature}
              unlocked={bundleUnlocked}
              source="saju"
              hookVariant="lens_bundle"
              currentLens="saju"
            />
          )
        ) : null}


        <LovyMessage pose="book" size={52}>
          {SAJU_COPY.notPrediction}
        </LovyMessage>

        <EntertainmentNotice>
          재미로 보는 참고 렌즈야. 동기화율·Relationship Mirror·관찰 기록에는 반영하지 않아.
        </EntertainmentNotice>
      </div>
    </ScreenLayout>
  );
}
