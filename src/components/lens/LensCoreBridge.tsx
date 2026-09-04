'use client';

import { useRouter } from 'next/navigation';

import { LovyNote } from '@/components/lovy/LovyNote';
import { LENS_BRIDGE_COPY } from '@/data/copy';
import { lensBridgeNote } from '@/data/lovyNotes';
import { cn } from '@/lib/cn';

/**
 * Lens → Core Bridge (v1.20 §12)
 *
 * MBTI·사주·별자리 결과 뒤에서 "이 렌즈에서는 이렇게 보여. 그런데 실제 관계에서는?"으로
 * **실제 관계 신호(Core)** 로 돌려보내는 연결 고리. 렌즈 위계(CORE > SUPPORTING >
 * ENTERTAINMENT)를 화면에서도 반복해서 드러낸다.
 *
 * ⚠️ 이번 버전에서 Lens 계산 로직은 한 줄도 바꾸지 않는다. 이 컴포넌트는 링크와 문구뿐이며,
 * 어느 렌즈 화면에서도 그대로 재사용할 수 있게 `href`만 받는다.
 *
 * Analytics 이벤트를 새로 만들지 않는다(§16) — 이 버튼이 향하는 `/compatibility`가 이미
 * `compatibility_result_view`·`compatibility_result_revisit`를 발생시킨다.
 */
export function LensCoreBridge({
  href,
  className,
}: {
  /** 돌아갈 Core 결과 위치 (예: `/compatibility#good`) */
  href: string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <p className="px-1 text-[10px] font-semibold tracking-[0.16em] text-ink-faint">
        {LENS_BRIDGE_COPY.eyebrow}
      </p>

      <LovyNote>{lensBridgeNote().text}</LovyNote>

      <button
        type="button"
        onClick={() => router.push(href)}
        className="flex min-h-11 items-center justify-between rounded-row border border-line bg-surface px-4 text-sub"
      >
        {LENS_BRIDGE_COPY.cta}
        <span className="text-ink-faint" aria-hidden>
          →
        </span>
      </button>
    </div>
  );
}
