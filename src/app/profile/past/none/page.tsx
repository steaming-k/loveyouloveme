'use client';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { Lovy } from '@/components/lovy/Lovy';
import { STATE_COPY } from '@/data/copy';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { ROUTES } from '@/lib/routes';
import { useSession } from '@/state/SessionProvider';

/**
 * 3 Layer 진행 상태.
 *
 * ⚠️ v1.36 — `Observed Me · 완료`가 **고정값이었다.** 사진 분석이 실패한 사용자
 * (`NO_USABLE_IMAGE`)나 사진을 고르지 않은 사용자에게도 '완료'가 떴다 —
 * 같은 세션에서 `/profile/result`는 `아직 기록이 없어`라고 말하는데 이 화면만
 * 완료라고 했다(실측). 실제 상태에서 만든다.
 */
function layerStatus(hasObserved: boolean) {
  return [
    hasObserved
      ? { label: 'Observed Me · 완료', tone: 'mint' as const }
      : { label: 'Observed Me · 사진 근거 없음', tone: 'pending' as const },
    { label: 'Declared Me · 완료', tone: 'purple' as const },
    { label: 'Relationship Me · 경험이 생기면', tone: 'pending' as const },
  ];
}

/**
 * E4 연애 경험 없음
 * 흐름을 막지 않는다. 지금의 기준을 기록해두고 나중에 실제 경험과 비교하도록 안내한다.
 */
export default function NoExperiencePage() {
  const router = useRouter();
  const { answers, markComplete } = useSession();
  const copy = STATE_COPY.noExperience;

  /** 사진 근거가 실제로 있는가 — `/profile/result`의 Observed 섹션과 같은 기준이다 */
  const hasObserved = answers.photos.length > 0 && (answers.observedAnalysis?.traits.length ?? 0) > 0;
  const LAYER_STATUS = layerStatus(hasObserved);

  return (
    <ScreenLayout
      header={<ScreenHeader backHref={ROUTES.pastIntro} />}
      footer={
        <Button
          onClick={() => {
            markComplete('experience');
            markComplete('profile');
            trackEvent('profile_complete', { path: 'no_experience' });
            /**
             * ⚠️ v1.36 P0 — **`/target`으로 바로 보내지 않는다.**
             *
             * v1.29 P4가 `/profile/result`에 Solo 분기(`내 관계 관찰 보기` /
             * `관심 가는 사람이 있어`)를 만들었는데, 이 화면만 v1.28 그대로
             * `/target`을 밀고 있었다. 그래서 **상대가 없다고 답한 사용자**가
             * 프로필을 다 채운 뒤 상대 입력 화면에 도착했고, 거기서는
             * `아는 항목 하나라도 알려줘`에 막혀 더 갈 수 없었다 —
             * First Contact Report는 퍼널에서 도달 불가였다(실측).
             *
             * 이제 다른 경로(과거 질문 3단)와 **같은 목적지**로 보낸다.
             * 상대 입력을 없애는 게 아니라, 분기 화면이 고르게 한다.
             */
            router.push(ROUTES.profileResult);
          }}
        >
          내 관찰 기록 보기
        </Button>
      }
      centered
    >
      <div className="flex w-full flex-col gap-[18px] pb-10">
        <Lovy pose={copy.pose} size={110} decorative className="self-center" />

        <h1 className="text-center text-[21px] font-semibold leading-relaxed tracking-[-0.5px] keep-all">
          {copy.title.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h1>

        <p className="text-center text-[13.5px] leading-relaxed keep-all text-ink-sub">
          {copy.body}
        </p>

        <ul className="flex flex-col gap-2.5 rounded-[16px] border border-line bg-surface p-4">
          {LAYER_STATUS.map((layer) => (
            <li key={layer.label} className="flex items-center gap-2.5">
              <span
                className={cn(
                  'h-[18px] w-[18px] flex-none rounded-[5px]',
                  layer.tone === 'mint' && 'bg-mint-tint',
                  layer.tone === 'purple' && 'bg-brand-edge',
                  layer.tone === 'pending' && 'border border-dashed border-dash',
                )}
                aria-hidden
              />
              <span
                className={cn(
                  'text-[13.5px] keep-all',
                  layer.tone === 'pending' && 'text-ink-muted',
                )}
              >
                {layer.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ScreenLayout>
  );
}
