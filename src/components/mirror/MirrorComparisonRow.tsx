import type { CSSProperties } from 'react';

import { cn } from '@/lib/cn';
import { valueToPercent } from '@/lib/logic/mirror';
import type { MirrorInsight, MirrorState } from '@/types';

const STATE_TAG: Record<MirrorState, string> = {
  MATCH: 'bg-mint-tint text-mint-deep',
  GAP: 'bg-brand-tint text-brand-pressed',
  CHANGE: 'bg-friction-tint text-friction-text',
};

const STATE_BAR: Record<MirrorState, string> = {
  MATCH: 'bg-mint',
  GAP: 'bg-brand',
  CHANGE: 'bg-friction',
};

/** 상태를 색만으로 구분하지 않기 위한 한국어 설명 */
const STATE_TEXT: Record<MirrorState, string> = {
  MATCH: '말한 기준과 비슷',
  GAP: '관계에서 더 크게',
  CHANGE: '경험 후 낮아짐',
};

/**
 * 항목별 대조 행 (S27)
 * 하나의 트랙에 '말한 나'(빈 핸들)와 '관계 속 나'(채운 핸들)를 함께 놓고,
 * 두 값 사이 구간을 상태 색으로 채워 Gap을 시각적으로 드러낸다.
 */
export function MirrorComparisonRow({
  insight,
  index,
}: {
  insight: MirrorInsight;
  index: number;
}) {
  const low = Math.min(insight.declared, insight.relationship);
  const high = Math.max(insight.declared, insight.relationship);
  const barWidth = `${((high - low) / 4) * 92}%`;

  return (
    <li
      className="reveal-up flex flex-col gap-2.5 rounded-row border border-line bg-surface px-[15px] py-3.5"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex items-center justify-between gap-2.5">
        <h3 className="text-[14.5px] font-medium tracking-[-0.2px]">{insight.label}</h3>
        <span
          className={cn(
            'flex-none rounded-[6px] px-2 py-1 text-label tracking-[0.06em]',
            STATE_TAG[insight.state],
          )}
        >
          {insight.state}
        </span>
      </div>

      <div className="relative h-5" aria-hidden>
        <span className="absolute inset-x-0 top-2 h-1 rounded-sm bg-track" />

        <span
          className={cn('reveal-bar absolute top-2 h-1 rounded-sm', STATE_BAR[insight.state])}
          style={
            {
              left: valueToPercent(low),
              '--bar-width': barWidth,
              animationDelay: `${120 + index * 80}ms`,
            } as CSSProperties
          }
        />

        <span
          className="absolute top-[3px] -ml-[7px] h-3.5 w-3.5 rounded-full border-2 border-ink-faint bg-surface"
          style={{ left: valueToPercent(insight.declared) }}
        />
        <span
          className="absolute top-[3px] -ml-[7px] h-3.5 w-3.5 rounded-full bg-brand"
          style={{ left: valueToPercent(insight.relationship) }}
        />
      </div>

      <p className="sr-only">
        {insight.label}: 네가 말한 너 {insight.declared}점, 관계 속의 너 {insight.relationship}점.{' '}
        {STATE_TEXT[insight.state]}.
      </p>

      <p className="text-[12.5px] keep-all leading-relaxed text-[#555]">{insight.note}</p>
    </li>
  );
}

/** 트랙 범례 — 색 이름 대신 무엇을 뜻하는지 적는다 */
export function MirrorLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1">
      <span className="text-meta font-semibold text-ink-muted">항목별 대조</span>
      <span className="flex items-center gap-1.5">
        <span
          className="h-[11px] w-[11px] rounded-full border-2 border-ink-faint bg-surface"
          aria-hidden
        />
        <span className="text-[11px] text-ink-muted">말한 나</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-[11px] w-[11px] rounded-full bg-brand" aria-hidden />
        <span className="text-[11px] text-ink-muted">관계 속 나</span>
      </span>
    </div>
  );
}
