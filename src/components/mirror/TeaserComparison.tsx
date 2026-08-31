import type { MirrorTeaser } from '@/types';

/**
 * Mirror Teaser 의 신호 대조 (S26)
 * '내 분석 보기' 버튼 하나로 끝내지 않고, 무엇이 어긋났는지 먼저 보여준다.
 * 이 화면이 Primary KPI(궁합 → Mirror 진입) 의 전환 지점이다.
 */
export function TeaserComparison({ teaser }: { teaser: MirrorTeaser }) {
  return (
    <div className="flex flex-col rounded-card border border-line bg-surface px-4 py-[18px]">
      <p className="mb-3 text-[11px] font-semibold tracking-[0.06em] text-ink-muted">
        {teaser.axisLabel} · 신호 대조
      </p>

      <div className="rounded-row border border-dashed border-dash bg-canvas-warm px-[15px] py-3.5">
        <p className="mb-1.5 text-[10.5px] text-ink-muted">네가 말한 너</p>
        <p className="text-[15.5px] keep-all leading-snug tracking-[-0.2px]">
          {teaser.declaredPhrase}
        </p>
      </div>

      <div className="flex items-center gap-2.5 py-2.5 pl-5">
        <span className="h-[18px] w-px bg-friction" aria-hidden />
        <span className="text-[11px] font-semibold tracking-[0.04em] text-friction-text">VS</span>
      </div>

      <div
        className="reveal-up rounded-row border border-brand bg-brand-tint px-[15px] py-3.5"
        style={{ animationDelay: '250ms' }}
      >
        <p className="mb-1.5 text-[10.5px] text-brand-pressed">관계에서 나타난 너</p>
        <p className="text-[15.5px] font-medium keep-all leading-snug tracking-[-0.2px]">
          {teaser.relationshipPhrase}
        </p>
      </div>
    </div>
  );
}
