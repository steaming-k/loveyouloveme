'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/common/Button';
import { HydrationGate } from '@/components/common/HydrationGate';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { PageHeading, SectionLabel, Tag } from '@/components/common/primitives';
import { LENS_HUB_COPY } from '@/data/copy';
import { trackEvent } from '@/lib/analytics';
import { lensAvailability } from '@/lib/logic/birth';
import { ROUTES } from '@/lib/routes';
import { useCompatibility, useMbtiLens } from '@/hooks/useAnalysis';
import { useSession } from '@/state/SessionProvider';
import type { EntertainmentLensType } from '@/types';

/**
 * S22a 우리 둘을 보는 다른 렌즈 (허브)
 *
 * S21 Hero와 S22 Detail이 렌즈 뱃지로 뒤덮이지 않도록, 렌즈 진입점을 한 곳에 모았다.
 * 화면 순서 자체가 위계다 — CORE → SUPPORTING → ENTERTAINMENT.
 *
 * ⚠️ 여기 있는 어떤 렌즈도 동기화율에 합산되지 않는다. `Main Score + Saju Score` 같은
 * '최종 궁합 점수'를 만들지 않는다.
 */
export default function CompatibilityLensesPage() {
  return (
    <HydrationGate>
      <CompatibilityLensesView />
    </HydrationGate>
  );
}

function CompatibilityLensesView() {
  const router = useRouter();
  const { answers } = useSession();
  const result = useCompatibility();
  const mbtiLens = useMbtiLens();
  const [today] = useState(() => new Date());

  const availability = lensAvailability(answers.birthProfile, answers.target.birthProfile, today);

  const entertainmentStatus = availability.couple
    ? { label: '우리 둘 보기 →', active: true }
    : availability.self
      ? { label: '상대 정보 필요', active: false }
      : { label: '정보 입력하기', active: false };

  const goEntertainment = (lens: EntertainmentLensType) => {
    trackEvent('entertainment_lens_entry_click', { lens });
    router.push(lens === 'saju' ? ROUTES.lensSaju : ROUTES.lensAstrology);
  };

  return (
    <ScreenLayout
      header={<ScreenHeader backHref={ROUTES.compatibilityWhy} title="다른 렌즈" />}
      footer={
        <Button variant="secondary" onClick={() => router.push(ROUTES.compatibilityWhy)}>
          궁합 상세로 돌아가기
        </Button>
      }
      bodyClassName="pt-1.5 pb-4"
    >
      <div className="flex flex-col gap-5">
        <PageHeading lines={LENS_HUB_COPY.title} caption={LENS_HUB_COPY.caption} />

        {/* CORE */}
        <section className="flex flex-col gap-2">
          <SectionLabel>{LENS_HUB_COPY.coreLabel}</SectionLabel>
          <button
            type="button"
            onClick={() => router.push(ROUTES.compatibilityWhy)}
            className="flex items-center justify-between gap-3 rounded-row border border-brand-edge bg-brand-tint p-4 text-left"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-[14.5px] font-semibold text-brand-ink">
                동기화율 {result.score ?? '?'}
              </p>
              <p className="text-[12.5px] keep-all text-brand-pressed">
                {LENS_HUB_COPY.coreCaption}
              </p>
            </div>
            <Tag tone="brand">보기 →</Tag>
          </button>
        </section>

        {/* SUPPORTING */}
        <section className="flex flex-col gap-2">
          <SectionLabel>{LENS_HUB_COPY.supportingLabel}</SectionLabel>
          <LensRow
            title="MBTI Lens"
            caption="두 유형의 선호 차이를 대화 주제로 보기"
            status={
              mbtiLens
                ? { label: `${mbtiLens.mine} × ${mbtiLens.theirs}`, active: true }
                : { label: '정보 입력하기', active: false }
            }
            onClick={() => router.push(ROUTES.lensMbti)}
          />
        </section>

        {/* ENTERTAINMENT — 마지막. 시각적으로도 가장 약하게 */}
        <section className="flex flex-col gap-2">
          <SectionLabel>{LENS_HUB_COPY.entertainmentLabel}</SectionLabel>
          <LensRow
            title="사주 Lens"
            caption="전통 해석으로 우리 둘 보기"
            status={entertainmentStatus}
            onClick={() => goEntertainment('saju')}
          />
          <LensRow
            title="Astrology Lens"
            caption="별자리 관점으로 우리 둘 보기"
            status={entertainmentStatus}
            onClick={() => goEntertainment('astrology')}
          />
        </section>
      </div>
    </ScreenLayout>
  );
}

function LensRow({
  title,
  caption,
  status,
  onClick,
}: {
  title: string;
  caption: string;
  status: { label: string; active: boolean };
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-row border border-line bg-surface p-4 text-left active:bg-sunken"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="text-[14.5px] font-medium">{title}</h3>
        <p className="text-[12.5px] keep-all text-ink-sub">{caption}</p>
      </div>
      <Tag tone={status.active ? 'brand' : 'neutral'}>{status.label}</Tag>
    </button>
  );
}
