import { Check, ChevronDown, ChevronUp } from 'lucide-react';

import { cn } from '@/lib/cn';
import { valueToPercent } from '@/lib/logic/mirror';
import type { MirrorInsight, MirrorState } from '@/types';

const STATE_TAG: Record<MirrorState, string> = {
  MATCH: 'bg-mint-tint text-mint-deep',
  GAP: 'bg-brand-tint text-brand-pressed',
  CHANGE: 'bg-friction-tint text-friction-text',
  UNKNOWN: 'bg-chip text-ink-muted',
};

const STATE_DOT: Record<MirrorState, string> = {
  MATCH: 'bg-mint',
  GAP: 'bg-brand',
  CHANGE: 'bg-friction',
  UNKNOWN: 'bg-ink-faint',
};

/** 상태를 색만으로 구분하지 않기 위한 한국어 설명 */
const STATE_TEXT: Record<MirrorState, string> = {
  MATCH: '말한 기준과 비슷',
  GAP: '관계에서 더 크게',
  CHANGE: '경험 후 낮아짐',
  UNKNOWN: '관측 정보 부족',
};

/**
 * Mirror Gap Map — 항목별 대조 행 (S27)
 *
 * ⚠️ 트랙 위에는 '말한 나'(Declared) 점 하나만 정확한 위치로 찍는다. Relationship Me는
 * 과거 관계 질문에서 1~5 척도로 직접 수집된 값이 아니므로, 두 번째 점을 정밀한 위치에
 * 찍으면 실제보다 더 정밀하게 측정된 것처럼 보이는 착시가 생긴다. 대신 '관계 경험에서
 * 발견한 신호'는 방향(▲ 더 크게 반응 / ▼ 낮아짐 / ✓ 비슷함)과 근거 문장으로만 말한다.
 */
export function MirrorComparisonRow({
  insight,
  index,
}: {
  insight: MirrorInsight;
  index: number;
}) {
  return (
    <li
      className="reveal-up flex flex-col gap-3 rounded-row border border-line bg-surface px-[15px] py-3.5"
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

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[10.5px] text-ink-muted">
          <span>말한 나</span>
          {insight.declaredHasScale ? <span className="tnum">{insight.declared}/5</span> : null}
        </div>
        <div className="relative h-4" aria-hidden>
          <span className="absolute inset-x-0 top-[7px] h-1 rounded-sm bg-track" />
          <span
            className="absolute top-1 -ml-[7px] h-3 w-3 rounded-full border-2 border-ink-faint bg-surface"
            style={{ left: valueToPercent(insight.declared) }}
          />
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-[10px] bg-sunken px-3 py-2.5">
        <span
          className={cn(
            'mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full text-white',
            STATE_DOT[insight.state],
          )}
          aria-hidden
        >
          {insight.state === 'GAP' ? <ChevronUp size={11} strokeWidth={3} /> : null}
          {insight.state === 'CHANGE' ? <ChevronDown size={11} strokeWidth={3} /> : null}
          {insight.state === 'MATCH' ? <Check size={10} strokeWidth={3} /> : null}
        </span>
        <p className="text-[12.5px] keep-all leading-relaxed text-[#555]">
          {insight.relationshipSignal}
        </p>
      </div>

      <p className="sr-only">
        {insight.label}: 말한 나 {insight.declared}점. {STATE_TEXT[insight.state]}.
      </p>

      <p className="text-[12.5px] keep-all leading-relaxed text-[#555]">{insight.note}</p>
    </li>
  );
}

/** 범례 — '말한 나'만 정확한 위치, 관계 경험 신호는 방향으로만 말한다는 것을 알려준다 */
export function MirrorLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1">
      <span className="text-meta font-semibold text-ink-muted">항목별 대조</span>
      <span className="flex items-center gap-1.5">
        <span
          className="h-[11px] w-[11px] rounded-full border-2 border-ink-faint bg-surface"
          aria-hidden
        />
        <span className="text-[11px] text-ink-muted">말한 나(정확한 위치)</span>
      </span>
      <span className="flex items-center gap-1.5">
        <ChevronUp size={12} className="text-brand" aria-hidden />
        <span className="text-[11px] text-ink-muted">관계 경험 신호(방향)</span>
      </span>
    </div>
  );
}
