'use client';

import { trackEvent } from '@/lib/analytics';
import type { AnalyticsEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';

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
 *
 * v1.23 §18 — **시각 높이와 터치 영역을 분리했다.** 칩의 보이는 높이는 32px 그대로 두고
 * (44px로 키우면 nav 한 덩어리가 100px을 넘어 LEVEL 1을 밀어낸다), `::after`로 만든
 * 투명 hit area가 실제 터치 타깃을 **44px**로 넓힌다. 칩 사이 간격(gap 6px)보다 넓게
 * 늘리면 인접 칩과 겹쳐 오터치가 나므로, 세로로만 늘리고 가로는 칩 폭을 그대로 쓴다.
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
      /* hit area가 세로로 넘치므로 부모가 잘라내지 않게 한다 */
      style={{ overflow: 'visible' }}
    >
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          onClick={() => trackEvent(event, { section: item.id })}
          className={cn(
            'relative flex-none rounded-full border border-line bg-surface px-3 py-1.5',
            'text-[12px] font-medium text-ink-sub active:bg-sunken',
            // 보이는 높이 32px · 실제 터치 타깃 44px (§18 · §32)
            "after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-['']",
          )}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
