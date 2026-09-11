'use client';

import { useRouter } from 'next/navigation';

import { LovySequence } from '@/components/lovy/LovySequence';
import { BRAND } from '@/data/copy';
import { ROUTES } from '@/lib/routes';
import { useSession } from '@/state/SessionProvider';

export default function SplashPage() {
  const router = useRouter();
  const { answers, hydrated } = useSession();

  // 이미 관찰 기록이 있는 사용자는 홈으로 보낸다.
  const destination = hydrated && answers.completed.profile ? ROUTES.home : ROUTES.onboarding;

  return (
    <div className="flex h-full flex-col">
      <button
        type="button"
        onClick={() => router.push(destination)}
        aria-label="관찰 시작하기"
        className="flex flex-1 flex-col items-center justify-center px-6 pb-[60px] text-center"
      >
        <p className="text-label tracking-[0.22em] text-ink-muted">{BRAND.splashLabel}</p>

        {/*
          v1.46 §15~§19 — 첫 화면의 러비가 **관찰 루프**를 돈다.
          기본 관찰 → 발견 → 돋보기 → 기록. 러비가 무엇을 하는 존재인지가
          카피를 읽기 전에 먼저 보인다.

          ⚠️ `float`(안테나 상하 loop)을 **함께 걸지 않았다.** 프레임 전환(3.2초)과
          float(4.5초)이 겹치면 주기가 다른 두 loop가 서로 어긋나며 계속 흔들리고,
          그건 '살아 있다'가 아니라 '가만히 있지 않는다'로 읽힌다(§24 — 절제된 움직임).
          움직임의 역할은 시퀀스 하나가 맡는다.
        */}
        <LovySequence size={196} priority className="mt-[26px] mb-2" />

        <p className="text-[30px] font-bold tracking-[-1px]">{BRAND.name}</p>

        <span className="mt-3.5 flex items-center gap-[7px]">
          <span className="h-1.5 w-1.5 animate-lovy-pulse rounded-full bg-brand" />
          <span className="text-sub text-ink-sub">{BRAND.splashCopy}</span>
        </span>
      </button>

      <p className="flex-none px-gutter pb-[30px] text-center text-meta text-ink-faint">
        화면을 탭하면 관찰이 시작돼
      </p>
    </div>
  );
}
