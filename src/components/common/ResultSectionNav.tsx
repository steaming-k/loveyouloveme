'use client';

import { trackEvent } from '@/lib/analytics';
import type { AnalyticsEvent } from '@/lib/analytics';

/**
 * Result Section Navigator (v1.11 §36)
 *
 * 통합된 Compatibility/Mirror Result 화면 상단에 두는 작은 앵커 칩 목록.
 * 모바일 공간을 많이 먹는 sticky tab bar는 쓰지 않는다 — 그냥 눌렀을 때 그 section으로
 * 스크롤하는 링크 묶음이다.
 */
export function ResultSectionNav({
  items,
  event,
}: {
  items: readonly { id: string; label: string }[];
  /** 눌렀을 때 남길 이벤트 이름. properties: section */
  event: AnalyticsEvent;
}) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="결과 섹션 바로가기"
      className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5"
    >
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          onClick={() => trackEvent(event, { section: item.id })}
          className="flex-none rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-ink-sub active:bg-sunken"
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
