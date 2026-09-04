'use client';

import { useEffect, useRef } from 'react';

import { Lovy } from '@/components/lovy/Lovy';
import { trackEvent, trackOncePerAnalysis } from '@/lib/analytics';
import type { LovySurprise } from '@/data/lovyNotes';

/**
 * FIRST SURPRISE (v1.20 §2/§11)
 *
 * 무료 궁합 결과에서 사용자가 숫자를 이해한 **직후**, 근거를 읽기 전에 한 번 나온다.
 * "궁합 점수를 주는 서비스인 줄 알았는데, 관계를 보는 방식이 다르네"를 만드는 지점이다.
 *
 * ⚠️ Premium 광고가 아니다 — 가격·잠금·결제 CTA를 넣지 않는다. 무료 사용자가 이 서비스의
 * 해석 방식을 이해하는 것이 목적이고, 이어지는 CTA는 **무료 본문**으로 내려보낸다.
 *
 * Analytics는 새 이벤트를 하나만 늘렸다(`lovy_surprise_view`). '이어서 봤는가'는 기존
 * `result_anchor_navigation`(section 속성)으로 이미 측정되므로 새로 만들지 않는다.
 */
export function FirstSurprise({
  surprise,
  ctaHref,
  ctaSection,
  funnelAnalysisId,
}: {
  surprise: LovySurprise;
  ctaHref: string;
  /** 기존 anchor 이벤트에 남길 섹션 id */
  ctaSection: string;
  funnelAnalysisId: string | null;
}) {
  const sent = useRef(false);

  useEffect(() => {
    // 같은 분석을 Revisit·새로고침으로 다시 봐도 중복 집계되지 않는다. 새 상대를 분석하면
    // funnelAnalysisId가 새로 발급되므로 그때는 다시 한 번 발생한다.
    if (sent.current || !funnelAnalysisId) return;
    sent.current = true;
    // ⚠️ 문구 원문은 절대 보내지 않는다 — opaque variant만 보낸다(§16).
    trackOncePerAnalysis('lovy_surprise_view', funnelAnalysisId, {
      surprise_variant: surprise.variant,
    });
  }, [funnelAnalysisId, surprise.variant]);

  return (
    <aside className="flex flex-col gap-3 rounded-card bg-mint-tint px-4 py-4">
      <div className="flex items-start gap-2.5">
        <Lovy pose="question" size={38} decorative className="-mt-0.5" />
        <p className="text-[15px] font-semibold leading-[1.5] keep-all text-mint-ink">
          {surprise.hook}
        </p>
      </div>

      <p className="text-[13.5px] keep-all leading-relaxed text-ink">{surprise.body}</p>

      <a
        href={ctaHref}
        onClick={() => trackEvent('result_anchor_navigation', { section: ctaSection })}
        className="flex min-h-11 items-center text-[12.5px] font-semibold text-mint-ink"
      >
        실제 관계 신호 보기 ↓
      </a>
    </aside>
  );
}
