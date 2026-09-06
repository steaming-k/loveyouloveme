import type { ReactNode } from 'react';

import { REPORT_COPY } from '@/data/copy';
import { cn } from '@/lib/cn';

/**
 * 러비 관찰 노트 (Margin Note · v1.20)
 *
 * 러비의 화법과 보고서의 화법을 **색과 형태로** 구분한다:
 *   Lovy   = Mint · 좌측 rule · 혼잣말   (personality)
 *   Report = Neutral · 번호 · 정돈된 문장 (credibility)
 *
 * 말풍선(`LovyMessage`)은 러비가 사용자에게 말을 거는 자리에 쓰고, 이 노트는 보고서
 * 본문 옆에 러비가 적어둔 생각에 쓴다. 모바일에서 진짜 좌우 margin에 억지로 띄우지
 * 않고 흐름 안의 inline annotation으로 둔다 — 393px 프레임에서 float은 본문을 깨뜨린다.
 */
export function LovyNote({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  /**
   * 라벨 문구. 기본은 `LOVY NOTE`(짧은 혼잣말)이고, 무료에서 보장하는 심리·철학
   * Observation(§6)에는 `LOVY OBSERVATION`을 넘겨 **의도된 제품 요소**로 읽히게 한다 —
   * 섹션 끝에 남은 각주처럼 보이지 않게 하는 최소 장치다.
   */
  label?: string;
}) {
  return (
    <aside className={cn('flex flex-col gap-1 border-l-2 border-mint pl-3.5', className)}>
      <p className="text-[10px] font-semibold tracking-[0.16em] text-mint-ink">
        {label ?? REPORT_COPY.noteLabel}
      </p>
      <p className="text-[13px] keep-all leading-relaxed text-[#555]">{children}</p>
    </aside>
  );
}
