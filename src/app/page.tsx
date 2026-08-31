'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Lovy } from '@/components/lovy/Lovy';
import { BRAND } from '@/data/copy';
import { ROUTES } from '@/lib/routes';
import { useSession } from '@/state/SessionProvider';

/** S01 스플래시 — 화면을 탭하면 관찰이 시작된다. 자동 진입도 함께 걸어둔다. */
const AUTO_ADVANCE_MS = 2600;

export default function SplashPage() {
  const router = useRouter();
  const { answers, hydrated } = useSession();

  // 이미 관찰 기록이 있는 사용자는 홈으로 보낸다.
  const destination = hydrated && answers.completed.profile ? ROUTES.home : ROUTES.onboarding;

  useEffect(() => {
    const timer = setTimeout(() => router.push(destination), AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [router, destination]);

  return (
    <div className="flex h-full flex-col">
      <button
        type="button"
        onClick={() => router.push(destination)}
        aria-label="관찰 시작하기"
        className="flex flex-1 flex-col items-center justify-center px-6 pb-[60px] text-center"
      >
        <p className="text-label tracking-[0.22em] text-ink-muted">{BRAND.splashLabel}</p>

        <Lovy pose="hero" size={196} float priority className="mt-[26px] mb-2" />

        <p className="text-[30px] font-bold tracking-[-1px]">{BRAND.name}</p>

        <span className="mt-3.5 flex items-center gap-[7px]">
          <span className="h-1.5 w-1.5 animate-lovy-pulse rounded-full bg-brand" />
          <span className="text-sub text-ink-sub">{BRAND.splashCopy}</span>
        </span>
      </button>

      <p className="flex-none px-gutter pb-[30px] text-center text-meta text-ink-faint">
        화면을 탭하면 관찰이 시작돼요
      </p>
    </div>
  );
}
