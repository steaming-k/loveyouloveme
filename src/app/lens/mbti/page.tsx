'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/common/Button';
import { HydrationGate } from '@/components/common/HydrationGate';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { FillDataRow } from '@/components/common/StateScreens';
import { NoticeBox, PageHeading, SectionLabel, Tag } from '@/components/common/primitives';
import { MbtiLensPanel, MbtiSelfPanel } from '@/components/compatibility/MbtiLensPanel';
import { PremiumEntryRow } from '@/components/premium/PremiumEntryRow';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { MBTI_LENS_COPY } from '@/data/copy';
import { trackEvent } from '@/lib/analytics';
import { buildMbtiSelfLens } from '@/lib/logic/mbtiLens';
import { resolvePrice, resolvePriceVariant } from '@/lib/premiumVariant';
import { premiumFeatureState } from '@/services/premiumService';
import { ROUTES } from '@/lib/routes';
import { useMbtiLens } from '@/hooks/useAnalysis';
import { useSession } from '@/state/SessionProvider';

/**
 * X1-a MBTI Lens — Compatibility Lens **Detail** Screen
 *
 * 이 화면은 더 이상 내 MBTI를 처음 입력하는 곳이 아니다(그건 S13 Declared Me 마지막으로 이동).
 * 여기서는 이미 입력된 두 유형을 4개 선호 축으로 비교해서 '이야기해볼 차이'만 보여주고,
 * 수정이 필요하면 원래 입력 화면(S13 / S19)으로 되돌려보낸다.
 *
 * ⚠️ 이 화면의 어떤 값도 동기화율에 영향을 주지 않는다.
 */
export default function MbtiLensPage() {
  return (
    <HydrationGate>
      <MbtiLensView />
    </HydrationGate>
  );
}

function MbtiLensView() {
  const router = useRouter();
  const { answers } = useSession();
  const report = useMbtiLens();
  const [variant] = useState(() => resolvePriceVariant());

  const selfLens = useMemo(() => buildMbtiSelfLens(answers.mbti), [answers.mbti]);
  const targetLens = useMemo(() => buildMbtiSelfLens(answers.target.mbti), [answers.target.mbti]);

  useEffect(() => {
    trackEvent('mbti_lens_view', {
      mode: report ? 'couple' : selfLens ? 'self' : 'empty',
      has_self: Boolean(answers.mbti),
      has_target: Boolean(answers.target.mbti),
      self_mbti: answers.mbti ?? undefined,
      target_mbti: answers.target.mbti ?? undefined,
      same_axes: report?.sameCount,
      different_axes: report?.differentCount,
    });
  }, [report, selfLens, answers.mbti, answers.target.mbti]);

  return (
    <ScreenLayout
      header={<ScreenHeader action={<Tag tone="neutral">{MBTI_LENS_COPY.badge}</Tag>} />}
      footer={
        <Button variant="secondary" onClick={() => router.push(ROUTES.lens)}>
          렌즈 목록으로
        </Button>
      }
      bodyClassName="pt-1.5 pb-4"
    >
      <div className="flex flex-col gap-5">
        <PageHeading lines={MBTI_LENS_COPY.title} caption={MBTI_LENS_COPY.caption} />

        {/* STATE A — 내 MBTI가 없으면 상대 유무와 무관하게 내 입력부터 유도한다(Self First) */}
        {!selfLens ? (
          <section className="flex flex-col gap-3">
            <LovyMessage pose="question" size={52}>
              {answers.target.mbti ? MBTI_LENS_COPY.targetOnlyBody : MBTI_LENS_COPY.noSelfBody}
            </LovyMessage>
            <Button onClick={() => router.push(ROUTES.declared(4))}>
              {answers.target.mbti ? MBTI_LENS_COPY.targetOnlyCta : MBTI_LENS_COPY.noSelfCta}
            </Button>
          </section>
        ) : (
          <>
            {/* 01 MY LENS — 항상 먼저, 상대 정보와 무관하게 */}
            <section className="flex flex-col gap-2.5">
              <SectionLabel>{MBTI_LENS_COPY.selfSectionLabel}</SectionLabel>
              <MbtiSelfPanel lens={selfLens} label={MBTI_LENS_COPY.selfSectionLabel} />
            </section>

            {targetLens && report ? (
              <>
                {/* 02 TARGET LENS — 상대 정보가 있을 때만 */}
                <section className="flex flex-col gap-2.5">
                  <SectionLabel>{MBTI_LENS_COPY.targetSectionLabel}</SectionLabel>
                  <MbtiSelfPanel lens={targetLens} label={MBTI_LENS_COPY.targetSectionLabel} />
                </section>

                {/* 03 TOGETHER — 둘 다 있을 때만 */}
                <section className="flex flex-col gap-2.5">
                  <SectionLabel>{MBTI_LENS_COPY.togetherSectionLabel}</SectionLabel>
                  <MbtiLensPanel report={report} variant="full" />
                </section>

                <LovyMessage pose="book" size={56}>
                  {MBTI_LENS_COPY.lovyNote}
                </LovyMessage>
              </>
            ) : (
              // 상대 정보는 항상 Optional — 없다고 내 결과를 막지 않는다
              <section className="flex flex-col gap-3">
                <NoticeBox>{MBTI_LENS_COPY.noTargetTitle} {MBTI_LENS_COPY.noTargetBody}</NoticeBox>
                <Button variant="secondary" onClick={() => router.push(ROUTES.target)}>
                  {MBTI_LENS_COPY.noTargetCta}
                </Button>
              </section>
            )}
          </>
        )}

        <section className="flex flex-col gap-2">
          <SectionLabel>입력 수정</SectionLabel>
          <FillDataRow
            label={`내 MBTI${answers.mbti ? ` · ${answers.mbti}` : ' · 없음'}`}
            actionLabel="수정"
            onClick={() => router.push(ROUTES.declared(4))}
          />
          <FillDataRow
            label={`상대 MBTI${answers.target.mbti ? ` · ${answers.target.mbti}` : ' · 없음'}`}
            actionLabel="수정"
            onClick={() => router.push(ROUTES.target)}
          />
        </section>

        {/* MBTI를 강한 유료 Feature로 전면에 두지 않는다 — 상세 안의 한 항목일 뿐(§19) */}
        <PremiumEntryRow
          feature={premiumFeatureState('mbti_detail', resolvePrice(variant), {
            mbtiAvailable: Boolean(report),
          })}
        />

        <NoticeBox>{MBTI_LENS_COPY.scoreNotice}</NoticeBox>
      </div>
    </ScreenLayout>
  );
}
