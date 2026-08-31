import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface ScreenLayoutProps {
  /** 상단 고정 영역 (back · progress · title) */
  header?: ReactNode;
  /** 하단 sticky CTA 영역 */
  footer?: ReactNode;
  /** 본문을 스크롤 없이 세로 중앙에 두는 화면 (스플래시·로딩·Empty·Error) */
  centered?: boolean;
  /** 본문 좌우 여백 (기본 20px) */
  bodyClassName?: string;
  children: ReactNode;
}

/**
 * 모든 화면의 공통 골격.
 * 393×852 프레임 안에서 header / scroll body / sticky footer 3단으로 나눈다.
 * 하단 safe area 26px은 footer가 항상 확보한다.
 */
export function ScreenLayout({
  header,
  footer,
  centered = false,
  bodyClassName,
  children,
}: ScreenLayoutProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {header ? <div className="flex-none">{header}</div> : null}

      <div
        className={cn(
          'min-h-0 flex-1',
          centered
            ? 'flex flex-col items-center justify-center px-gutter'
            : 'overflow-y-auto overscroll-contain px-gutter',
          bodyClassName,
        )}
      >
        {children}
      </div>

      {footer ? (
        <div className="flex-none px-gutter pb-safe pt-3">{footer}</div>
      ) : (
        <div className="h-safe flex-none" aria-hidden />
      )}
    </div>
  );
}
