'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Button } from '@/components/common/Button';
import { HydrationGate } from '@/components/common/HydrationGate';
import { NoticeBox } from '@/components/common/primitives';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { Lovy } from '@/components/lovy/Lovy';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { LOVY_LINES, PRIVACY, STATE_COPY } from '@/data/copy';
import { trackEvent } from '@/lib/analytics';
import { ROUTES } from '@/lib/routes';
import { TeaserComparison } from '@/components/mirror/TeaserComparison';
import { useRelationshipNarrative } from '@/hooks/useAiNarrative';
import { useCompatibility, useMirror } from '@/hooks/useAnalysis';

/**
 * S26 Relationship Mirror Teaser — 가장 중요한 Funnel Transition
 *
 * 지금까지(S19~S25)는 '나 vs 그 사람'을 비교했다. 여기서 처음으로 '내가 말한 나 vs
 * 관계에서 나타난 나'를 비교한다 — 이게 서비스의 진짜 Aha Moment다. S18 Relationship
 * Profile은 이 비교를 미리 하지 않으므로, 사용자에게는 여기가 정말 처음 보는 발견이다.
 *
 * Primary KPI: relationship_mirror_entry_click / compatibility_result_view
 */
export default function MirrorTeaserPage() {
  return (
    <HydrationGate>
      <MirrorTeaserView />
    </HydrationGate>
  );
}

function MirrorTeaserView() {
  const router = useRouter();
  const mirror = useMirror();
  const compatibility = useCompatibility();

  /**
   * v1.7 §61 — Relationship Narrative **Prefetch.**
   *
   * 이 화면에 도달한 시점에 focusAxis·Mirror state·evidence가 모두 계산 가능하다.
   * 사용자가 CTA를 누르기 전에 미리 만들어두면 S27/S28은 캐시를 읽는다.
   *
   * ⚠️ 결과를 여기서 **쓰지 않는다.** Aha Moment는 S26의 deterministic 비교 그대로여야 하고
   * (§88-6), AI 문장이 Teaser에 끼어들면 안 된다. 호출만 하고 화면은 건드리지 않는다.
   */
  useRelationshipNarrative();

  useEffect(() => {
    if (!mirror.available || !mirror.teaser) return;
    trackEvent('relationship_mirror_teaser_view', {
      axis: mirror.teaser.axisKey,
      gap_count: mirror.gapCount,
      score: compatibility.score ?? 0,
    });
  }, [mirror.available, mirror.teaser, mirror.gapCount, compatibility.score]);

  // 관계 경험이 없는 사용자에게는 Declared vs Relationship을 비교할 근거가 없다.
  // 가짜 비교를 만들지 않고, Mirror CTA도 억지로 제공하지 않는다.
  if (!mirror.available || !mirror.teaser) {
    const copy = STATE_COPY.mirrorUnavailable;
    return (
      <ScreenLayout
        centered
        footer={
          <Button
            onClick={() => {
              trackEvent('relationship_mirror_postpone', { reason: 'no_experience' });
              router.push(ROUTES.home);
            }}
          >
            홈으로
          </Button>
        }
      >
        <div className="flex flex-col items-center gap-4 pb-10 text-center">
          <Lovy pose={copy.pose} size={110} decorative />
          <p className="text-section keep-all">
            {copy.body.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </p>
          <p className="text-sub keep-all leading-relaxed text-ink-sub">{copy.footer}</p>
        </div>
      </ScreenLayout>
    );
  }

  const { teaser } = mirror;

  return (
    <ScreenLayout
      footer={
        <div className="flex flex-col gap-0.5">
          <Button
            className="h-[56px] text-[16.5px]"
            onClick={() => {
              trackEvent('relationship_mirror_entry_click', {
                axis: teaser.axisKey,
                score: compatibility.score ?? 0,
              });
              router.push(ROUTES.mirror);
            }}
          >
            관계 속의 나 확인하기
          </Button>
          <Button
            variant="text"
            onClick={() => {
              trackEvent('relationship_mirror_postpone');
              router.push(ROUTES.home);
            }}
          >
            나중에 볼게
          </Button>
        </div>
      }
      bodyClassName="pt-4 pb-4"
    >
      <div className="flex flex-col gap-5">
        <LovyMessage pose="observe" size={52} emphasis={LOVY_LINES.teaserOne} tone="lead">
          {LOVY_LINES.teaserTwo.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </LovyMessage>

        <TeaserComparison teaser={teaser} />

        <p className="px-1 text-[19px] font-semibold leading-relaxed tracking-[-0.5px] keep-all">
          {LOVY_LINES.teaserThree}
        </p>

        <NoticeBox>{PRIVACY.mirror}</NoticeBox>
      </div>
    </ScreenLayout>
  );
}
