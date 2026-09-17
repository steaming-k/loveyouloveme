'use client';

import { ChevronDown } from 'lucide-react';

import { Tag } from '@/components/common/primitives';
import { cn } from '@/lib/cn';

/**
 * 선택 입력 섹션의 열기 버튼 (260914 UT 후속 P1 STEP 4)
 *
 * UT에서 '펼치기' Tag가 잘 안 보였고, 왜 열어야 하는지도 몰라서 '안 열면 입력 없이 넘어가는
 * 것 같다'는 반응이 나왔다. 그래서 닫힌 상태에서는 **무엇이 좋아지는지(`benefit`)**와
 * brand 톤 CTA(`+ 더 알려주기`) · chevron을 함께 보여준다.
 *
 * ⚠️ **선택 입력임을 숨기지 않는다.** eyebrow에 항상 `· 선택`이 붙고, 닫혀 있어도 진행을
 * 막지 않는다. benefit 문장은 '점수가 정확해진다'처럼 없는 효과를 약속하지 않는다.
 *
 * ⚠️ 이미 입력한 값이 있으면 CTA 대신 그 요약(`filledLabel`)을 보여준다 — 예전 Tag 동작 그대로다.
 */
export function OptionalDisclosureButton({
  panelId,
  open,
  onToggle,
  eyebrow,
  title,
  hint,
  benefit,
  filledLabel,
}: {
  /** 펼쳐지는 영역의 id — `aria-controls` */
  panelId: string;
  open: boolean;
  onToggle: () => void;
  eyebrow: string;
  title: string;
  hint?: string;
  /** 닫혀 있고 아직 입력이 없을 때만 보이는 한 줄 — 열면 무엇이 달라지는지 */
  benefit: string;
  filledLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={panelId}
      className="flex min-h-11 w-full items-start justify-between gap-3 text-left"
    >
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-[10.5px] font-semibold tracking-[0.05em] text-ink-muted">
          {eyebrow} · 선택
        </span>
        <span className="text-caption font-medium">{title}</span>
        {hint ? <span className="text-[11.5px] keep-all text-ink-faint">{hint}</span> : null}
        {!open && !filledLabel ? (
          <span className="mt-0.5 text-[11.5px] font-medium keep-all text-brand-pressed">{benefit}</span>
        ) : null}
      </span>
      <span className="flex flex-none items-center gap-1 pt-0.5">
        {filledLabel ? (
          <Tag tone="brand">{filledLabel}</Tag>
        ) : (
          <span
            className={cn(
              'rounded-tag px-2.5 py-1.5 text-[11.5px] font-semibold',
              open ? 'bg-sunken text-ink-sub' : 'bg-brand-tint text-brand-pressed',
            )}
          >
            {open ? '접기' : '+ 더 알려주기'}
          </span>
        )}
        <ChevronDown
          aria-hidden
          size={16}
          className={cn('text-ink-muted transition-transform t-fast', open && 'rotate-180')}
        />
      </span>
    </button>
  );
}
