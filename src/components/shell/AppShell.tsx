'use client';

import type { ReactNode } from 'react';

import { AiDebugPanel } from '@/components/ai/AiDebugPanel';
import { ConsentBanner } from '@/components/common/ConsentBanner';
import { PrototypePanel } from './PrototypePanel';

/**
 * 앱 셸
 *
 * Mobile First — 기준 프레임 393×852. 360px에서도 깨지지 않아야 한다.
 * 데스크톱에서는 프레임만 가운데 띄우고 끝내지 않고, UT·개발에 쓸 수 있는
 * 프로토타입 패널(현재 계산값 · 화면 점프 · 답변 초기화)을 함께 둔다.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] justify-center bg-canvas lg:items-center lg:gap-9 lg:bg-[#F0EEE9] lg:px-8 lg:py-8">
      <div className="w-full max-w-[430px] lg:w-auto lg:max-w-none lg:flex-none lg:rounded-[52px] lg:bg-[#1A1A1A] lg:p-3 lg:shadow-[0_8px_24px_rgba(0,0,0,0.14)]">
        {/* 화면이 짧은 데스크톱에서도 프레임 전체가 보이도록 높이를 줄인다.
            relative는 BottomSheet/ConfirmModal의 absolute inset-0가 데스크톱에서
            브라우저 전체가 아니라 이 프레임 안에서만 뜨도록 기준점을 만든다. */}
        <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-canvas lg:h-[min(852px,calc(100dvh-88px))] lg:w-[393px] lg:rounded-[41px]">
          <main className="min-h-0 flex-1">{children}</main>
          <AiDebugPanel />
          <ConsentBanner />
        </div>
      </div>

      <PrototypePanel />
    </div>
  );
}
