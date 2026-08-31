'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/common/Button';
import { HydrationGate } from '@/components/common/HydrationGate';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { FillDataRow } from '@/components/common/StateScreens';
import { NoticeBox, PageHeading, SectionLabel, Tag } from '@/components/common/primitives';
import { MbtiLensPanel } from '@/components/compatibility/MbtiLensPanel';
import { PremiumEntryRow } from '@/components/premium/PremiumEntryRow';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { MBTI_LENS_COPY } from '@/data/copy';
import { MBTI_SELF_NOTE } from '@/data/mbti';
import { trackEvent } from '@/lib/analytics';
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

  useEffect(() => {
    if (!report) return;
    trackEvent('mbti_lens_view', {
      self_mbti: report.mine,
      target_mbti: report.theirs,
      same_axes: report.sameCount,
      different_axes: report.differentCount,
    });
  }, [report]);

  const selfNote = answers.mbti ? MBTI_SELF_NOTE[answers.mbti] : null;

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

        {report ? (
          <>
            <section className="flex flex-col gap-2.5">
              <SectionLabel>4가지 성향 비교</SectionLabel>
              <MbtiLensPanel report={report} variant="full" />
            </section>

            <LovyMessage pose="book" size={56}>
              {MBTI_LENS_COPY.lovyNote}
            </LovyMessage>
          </>
        ) : (
          <section className="flex flex-col gap-3">
            <NoticeBox>
              {answers.mbti
                ? '상대 MBTI가 아직 없어. 두 유형이 모두 있어야 비교 렌즈를 만들 수 있어.'
                : answers.target.mbti
                  ? '네 MBTI가 아직 없어. 두 유형이 모두 있어야 비교 렌즈를 만들 수 있어.'
                  : '아직 두 유형 모두 없어. 비교는 둘 다 입력했을 때만 할 수 있어.'}
            </NoticeBox>

            {selfNote ? (
              <LovyMessage pose="book" size={52}>
                <p className="mb-1.5 font-medium">{answers.mbti} · 이런 이야기가 있어</p>
                <p className="text-ink-sub">{selfNote}</p>
              </LovyMessage>
            ) : null}
          </section>
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
