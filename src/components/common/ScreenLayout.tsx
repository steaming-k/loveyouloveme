import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { SCREEN_SCROLL_ATTR } from '@/lib/scrollRestore';

interface ScreenLayoutProps {
  /** 상단 고정 영역 (back · progress · title) */
  header?: ReactNode;
  /** 하단 sticky CTA 영역 */
  footer?: ReactNode;
  /**
   * Post-analysis 화면 전용 하단 고정 메뉴(`BottomNavigation`). `footer`(CTA)와는 역할이
   * 달라 겹쳐 그리지 않고 footer 아래에 쌓는다 — CTA를 누르는 것과 큰 영역을 이동하는 것은
   * 같은 자리에서 경쟁하면 안 된다. `footer`가 없어도 `nav`만 줄 수 있다.
   */
  nav?: ReactNode;
  /** 본문을 스크롤 없이 세로 중앙에 두는 화면 (스플래시·로딩·Empty·Error) */
  centered?: boolean;
  /** 본문 좌우 여백 (기본 20px) */
  bodyClassName?: string;
  children: ReactNode;
}

/**
 * 모든 화면의 공통 골격.
 * 393×852 프레임 안에서 header / scroll body / sticky footer(+nav) 순으로 나눈다.
 * 하단 safe area 26px은 footer/nav가 없을 때만 spacer가 확보한다 — nav 자신의 하단
 * 여백(`BottomNavigation`의 `pb-6`)이 있으면 이중으로 쌓지 않는다.
 */
export function ScreenLayout({
  header,
  footer,
  nav,
  centered = false,
  bodyClassName,
  children,
}: ScreenLayoutProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {header ? <div className="flex-none">{header}</div> : null}

      {/*
        v1.22 §12 — 이 div가 앱의 실제 스크롤 주체다(document가 아니다). `useScrollRestore`가
        이 표식으로 컨테이너를 찾아 Back 복원 위치를 읽고 쓴다. 표식만 붙이고 레이아웃은
        그대로 둔다 — 이 컴포넌트는 복원 로직을 알지 못한다.
      */}
      <div
        {...{ [SCREEN_SCROLL_ATTR]: '' }}
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
        <div className={cn('flex-none px-gutter pt-3', nav ? 'pb-4' : 'pb-safe pb-4')}>
          {footer}
        </div>
      ) : null}
      {nav ?? (footer ? null : <div className="h-safe flex-none" aria-hidden />)}
    </div>
  );
}
