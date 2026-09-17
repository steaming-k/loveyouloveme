'use client';

import { Suspense, type ReactNode } from 'react';

import { AiDebugPanel } from '@/components/ai/AiDebugPanel';
import { BRAND } from '@/data/copy';
import { PremiumReturnWatcher } from '@/components/premium/PremiumReturnWatcher';
import { ConsentBanner } from '@/components/common/ConsentBanner';
import { NavTrailTracker } from './NavTrailTracker';
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
    /*
      ══ v1.48 §19 — 데스크톱은 '회색 배경 한가운데 아이폰'이 아니다 ═══════════

      예전 데스크톱 표현은 `#F1F1F1` 회색 벽 + `#1A1A1A` 기기 베젤(radius 52px) +
      drop shadow였다. 그건 **어느 앱에나 붙는 프로토타입 목업 템플릿**이고, 이
      제품의 스크린샷을 포트폴리오에 쓸 때 가장 먼저 보이는 것이 '목업 틀'이 된다.

      지금은 벽이 아니라 **관찰 기록의 지면**이다: 따뜻한 종이색 배경, 기기 베젤 없음,
      프레임은 얇은 rule 한 겹, 그림자 없음. 그리고 왼쪽 위에 Splash와 같은 편집
      marker가 있어서 데스크톱 화면 자체가 이 브랜드의 지면으로 읽힌다.

      ⚠️ 모바일에는 아무 영향이 없다 — 바뀐 것은 전부 `lg:` 분기다.
      ⚠️ 프레임 크기(393×852)와 `relative` 기준점은 그대로다. BottomSheet ·
      ConfirmModal의 `absolute inset-0`가 이 프레임 안에서만 떠야 하기 때문이다.
    */
    <div className="relative flex min-h-[100dvh] justify-center bg-canvas lg:items-center lg:gap-9 lg:bg-canvas-warm lg:px-8 lg:py-8">
      {/*
        v1.46.2 §Navigation — 방문 경로를 관찰한다. 화면을 그리지 않으므로 위치는
        아무 데나 좋지만, `useSearchParams`를 쓰므로 Suspense 경계가 필요하다.
      */}
      <Suspense fallback={null}>
        <NavTrailTracker />
      </Suspense>
      {/* v1.47 UT-2 — 입력 보완 뒤 Premium 자동 복귀. 결과 화면(체크포인트)에서만 판정한다 */}
      <Suspense fallback={null}>
        <PremiumReturnWatcher />
      </Suspense>

      {/*
        데스크톱 지면의 편집 marker — Splash와 같은 형태(rule + 넓은 자간)다.
        `PrototypePanel`처럼 개발 도구가 아니라 **브랜드의 지면 표식**이라
        production에서도 남는다. 모바일에서는 그리지 않는다(프레임이 화면 전체다).
      */}
      <div className="absolute top-8 left-9 hidden items-center gap-2.5 lg:flex" aria-hidden>
        <span className="h-px w-7 flex-none bg-rule-ink" />
        <span className="text-[10px] font-semibold tracking-[0.26em] text-ink-muted">
          {BRAND.splashLabel}
        </span>
      </div>

      <div className="w-full max-w-[430px] lg:w-auto lg:max-w-none lg:flex-none lg:rounded-[24px] lg:border lg:border-[color:var(--color-rule-mid)] lg:p-1.5">
        {/* 화면이 짧은 데스크톱에서도 프레임 전체가 보이도록 높이를 줄인다.
            relative는 BottomSheet/ConfirmModal의 absolute inset-0가 데스크톱에서
            브라우저 전체가 아니라 이 프레임 안에서만 뜨도록 기준점을 만든다. */}
        <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-canvas lg:h-[min(852px,calc(100dvh-88px))] lg:w-[393px] lg:rounded-[18px]">
          <main className="min-h-0 flex-1 pt-11">{children}</main>
          <AiDebugPanel />
          <ConsentBanner />
        </div>
      </div>

      <PrototypePanel />
    </div>
  );
}
