'use client';

import { cn } from '@/lib/cn';

interface SelectableRowProps {
  label: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
  /** radio 그룹 이름 — 키보드 탐색과 스크린리더용 */
  name: string;
  value: string;
}

/**
 * 단일 선택 행 (S05 관계 상태 / S11 갈등 / S16 힘들었던 순간 / S17 자기 차이)
 * 실제 radio input을 쓰고, 선택 상태는 배경·테두리·굵기·인디케이터 4가지로 드러낸다.
 */
export function SelectableRow({
  label,
  description,
  selected,
  onSelect,
  name,
  value,
}: SelectableRowProps) {
  return (
    <label
      /*
        ══ v1.48 §10 — 선택 **전**은 가볍게, 선택된 것만 무게를 갖는다 ══════════

        예전에는 모든 보기가 `border-line bg-surface` 흰 카드였다. 네 개를 쌓으면
        네 개의 카드가 있고, 그중 하나만 보라색이었다 — 선택은 '색 차이'였고
        나머지 셋도 똑같이 무거웠다(설문 폼의 형태다).

        지금 선택 전 보기는 테두리가 없다(따뜻한 배경만). 선택되면 테두리 · 배경 ·
        글자 굵기 · 인디케이터 네 가지가 **함께** 들어와서, 고른 것 하나만
        화면에서 솟는다.

        ⚠️ 테두리를 `transparent`로 두고 두께는 유지한다 — 선택 순간에 1px만큼
        레이아웃이 밀리면 그건 폴리시가 아니라 버그다(CLS 0).
      */
      className={cn(
        'flex cursor-pointer items-center justify-between gap-3 rounded-row border p-4 press-scale',
        selected
          ? 'border-brand bg-brand-tint'
          : 'border-transparent bg-canvas-warm active:bg-sunken',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={onSelect}
        className="peer sr-only"
      />

      <span className="min-w-0">
        <span
          className={cn(
            'block text-body keep-all',
            selected ? 'font-semibold' : 'font-normal',
          )}
        >
          {label}
        </span>
        {description ? (
          <span className="mt-1 block text-[12.5px] keep-all text-ink-sub">{description}</span>
        ) : null}
      </span>

      <span
        aria-hidden
        className={cn(
          'flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border transition-colors t-fast',
          selected ? 'border-brand bg-brand' : 'border-line-strong bg-transparent',
        )}
      >
        {selected ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
      </span>
    </label>
  );
}
