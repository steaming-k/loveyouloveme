'use client';

import { useState } from 'react';

import { UT_MODE } from '@/lib/env';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import type { AnalyticsEvent, AnalyticsProperties } from '@/lib/analytics';

/**
 * UT 평가 카드 (v1.7 · §43~§48)
 *
 * ⚠️ **연구용 UI다.** `NEXT_PUBLIC_UT_MODE=true`가 아니면 아무것도 렌더하지 않는다.
 * 일반 사용자 Production에서는 존재 자체가 보이지 않는다.
 *
 * ⚠️ 이 점수는 **분석 로직에 절대 쓰지 않는다.** 동기화율·Mirror·History·Core Insight
 * 어디에도 들어가지 않고, Analytics로만 나간다(§44).
 *
 * ⚠️ 한 화면에 여러 개 붙이지 않는다(§48). 화면별 배치:
 *   S09 = 관찰 유사도 / S28 = 근거 이해도 / F3 = 자기이해 도움 + 사진 가치
 */

const SCALE = [1, 2, 3, 4, 5] as const;

export function UtRatingCard({
  question,
  event,
  properties,
  lowLabel = '전혀 아니야',
  highLabel = '매우 그래',
}: {
  question: string;
  event: AnalyticsEvent;
  /** score 외에 함께 보낼 property. 자유서술·AI 문장은 넣지 않는다(§53) */
  properties?: AnalyticsProperties;
  lowLabel?: string;
  highLabel?: string;
}) {
  const [score, setScore] = useState<number | null>(null);

  // 플래그가 꺼져 있으면 DOM에 흔적도 남기지 않는다.
  if (!UT_MODE) return null;

  return (
    <section
      className="flex flex-col gap-2.5 rounded-card border border-dashed border-line-strong bg-sunken px-4 py-3.5"
      aria-label="사용성 테스트 문항"
    >
      <p className="flex items-center gap-1.5">
        <span className="rounded-[4px] bg-chip px-1.5 py-0.5 text-[9.5px] font-semibold tracking-[0.08em] text-ink-muted">
          UT
        </span>
        <span className="text-caption keep-all leading-relaxed">{question}</span>
      </p>

      <div className="flex gap-1.5" role="group" aria-label={question}>
        {SCALE.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={score === value}
            disabled={score !== null}
            onClick={() => {
              setScore(value);
              // 한 번 답하면 다시 보내지 않는다 — 새로고침 후 중복 방지는 화면 mount 기준(§82).
              trackEvent(event, { ...properties, score: value });
            }}
            className={cn(
              'min-h-11 flex-1 rounded-[10px] border text-[13px] tnum transition-colors duration-200',
              score === value
                ? 'border-brand bg-brand-tint font-semibold text-ink'
                : 'border-line bg-surface text-ink-sub',
              score !== null && score !== value && 'opacity-45',
            )}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="flex justify-between px-1 text-[10.5px] text-ink-faint">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>

      {score !== null ? (
        <p className="px-1 text-[10.5px] text-ink-muted">
          기록했어. 이 점수는 분석 결과에 반영되지 않아.
        </p>
      ) : null}
    </section>
  );
}
