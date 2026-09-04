'use client';

import { trackEvent } from '@/lib/analytics';
import type { AnalyticsEvent } from '@/lib/analytics';

/**
 * Result Section Navigator (v1.11 §36)
 *
 * 통합된 Compatibility/Mirror Result 화면 상단에 두는 작은 앵커 칩 목록.
 * 모바일 공간을 많이 먹는 sticky tab bar는 쓰지 않는다 — 그냥 눌렀을 때 그 section으로
 * 스크롤하는 링크 묶음이다.
 *
 * v1.22 §7 — 한 줄 가로 스크롤(`overflow-x-auto`)에서 **줄바꿈(`flex-wrap`)**으로 바꿨다.
 * 375px에서 칩 5개가 한 줄에 들어가지 않아 '다가갈 때'·'질문'이 화면 밖으로 잘렸고,
 * 스크롤 가능하다는 신호도 없어서 사용자는 답답한 한 줄로만 봤다. 이제 2줄로 나뉘어
 * 모든 라벨이 처음부터 보인다 — 새 sticky bar를 만들지 않고 줄만 늘렸다.
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
      className="-mx-1 flex flex-wrap gap-1.5 px-1 pb-0.5"
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
