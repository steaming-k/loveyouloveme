'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/common/Button';
import { HydrationGate } from '@/components/common/HydrationGate';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { PageHeading, SectionLabel, Tag } from '@/components/common/primitives';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { LENS_COPY, LOVY_LINES } from '@/data/copy';
import { trackEvent } from '@/lib/analytics';
import { isBirthDateUsable, lensAvailability } from '@/lib/logic/birth';
import { ROUTES } from '@/lib/routes';
import { useSession } from '@/state/SessionProvider';
import type { EntertainmentLensType } from '@/types';

/**
 * X1 러비의 관측 렌즈 — 위계를 화면에 그대로 드러낸다
 *
 *   CORE           실제 관계 신호 (동기화율) — 렌즈가 아니라 제품의 중심
 *   SUPPORTING     MBTI
 *   ENTERTAINMENT  사주 · Astrology
 *
 * 어떤 렌즈도 동기화율·Relationship Mirror·관찰 기록 계산에 관여하지 않는다.
 */
export default function LensPage() {
  return (
    <HydrationGate>
      <LensView />
    </HydrationGate>
  );
}

function LensView() {
  const router = useRouter();
  const { answers } = useSession();
  const [today] = useState(() => new Date());

  const availability = lensAvailability(answers.birthProfile, answers.target.birthProfile, today);
  const selfBirthReady = isBirthDateUsable(answers.birthProfile, today);

  /** 렌즈별 현재 상태 뱃지 */
  const statusFor = (href: string): { label: string; active: boolean } => {
    if (href === ROUTES.lensMbti) {
      const value =
        answers.mbti && answers.target.mbti
          ? `${answers.mbti} × ${answers.target.mbti}`
          : (answers.mbti ?? answers.target.mbti);
      return value ? { label: value, active: true } : { label: '보기 →', active: false };
    }

    // 사주·Astrology는 공용 출생정보 상태를 그대로 반영한다
    if (availability.couple) return { label: '우리 궁합 보기 →', active: true };
    if (selfBirthReady) return { label: '내 출생정보 입력됨', active: true };
    return { label: '보기 →', active: false };
  };

  const groups = [
    { key: 'SUPPORTING' as const, label: 'SUPPORTING' },
    { key: 'ENTERTAINMENT' as const, label: 'ENTERTAINMENT · 재미로 보기' },
  ];

  return (
    <ScreenLayout
      header={
        <ScreenHeader backHref={ROUTES.target} action={<Tag tone="neutral">{LENS_COPY.badge}</Tag>} />
      }
      footer={
        <Button variant="secondary" onClick={() => router.back()}>
          돌아가기
        </Button>
      }
      bodyClassName="pt-1.5 pb-4"
    >
      <div className="flex flex-col gap-5">
        <PageHeading lines={[LENS_COPY.title]} caption={LENS_COPY.caption} />

        {/* CORE — 렌즈 목록에서도 중심이 무엇인지 먼저 못박는다 */}
        <section className="flex flex-col gap-2">
          <SectionLabel>CORE</SectionLabel>
          <div className="flex flex-col gap-1 rounded-row border border-brand-edge bg-brand-tint p-4">
            <p className="text-[14.5px] font-semibold text-brand-ink">실제 관계 신호</p>
            <p className="text-[12.5px] keep-all text-brand-pressed">
              연락 · 갈등 해결 · 개인 시간 · 애정 표현 — 동기화율은 이것만으로 계산해요.
            </p>
          </div>
        </section>

        {groups.map((group) => (
          <section key={group.key} className="flex flex-col gap-2">
            <SectionLabel>{group.label}</SectionLabel>
            <ul className="flex flex-col gap-2.5">
              {LENS_COPY.items
                .filter((item) => item.group === group.key)
                .map((item) => {
                  const status = statusFor(item.href ?? '');

                  return (
                    <li key={item.title}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!item.href) return;
                          if (group.key === 'ENTERTAINMENT') {
                            trackEvent('entertainment_lens_entry_click', {
                              lens: item.href.includes('saju')
                                ? ('saju' satisfies EntertainmentLensType)
                                : ('astrology' satisfies EntertainmentLensType),
                            });
                          }
                          router.push(item.href);
                        }}
                        className="flex w-full items-center justify-between gap-3 rounded-row border border-line bg-surface p-4 text-left active:bg-sunken"
                      >
                        <div className="flex min-w-0 flex-col gap-1">
                          <h3 className="text-[14.5px] font-medium">{item.title}</h3>
                          <p className="text-[12.5px] keep-all text-ink-sub">{item.caption}</p>
                        </div>
                        <Tag tone={status.active ? 'brand' : 'neutral'}>{status.label}</Tag>
                      </button>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}

        {/* 두 Entertainment 렌즈가 같은 출생정보를 쓴다는 사실을 한 번만 알린다 */}
        <button
          type="button"
          onClick={() => router.push(ROUTES.lensBirth)}
          className="flex min-h-11 items-center justify-between gap-3 rounded-row border border-dashed border-line-strong bg-canvas-warm p-[15px] text-left"
        >
          <span className="text-[12.5px] keep-all text-[#555]">
            사주 · 별자리는 태어난 순간의 정보를 같이 써. 한 번만 입력하면 둘 다 볼 수 있어.
          </span>
          <span className="flex-none text-ink-muted" aria-hidden>
            →
          </span>
        </button>

        <LovyMessage pose="movie" size={56}>
          {LOVY_LINES.lens}
        </LovyMessage>
      </div>
    </ScreenLayout>
  );
}
