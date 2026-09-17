'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useCrossSourceInsights } from '@/hooks/useAiNarrative';
import { useMirror } from '@/hooks/useAnalysis';
import { useNavReplace } from '@/hooks/useContextualBack';
import { hasPremiumEvidence } from '@/lib/logic/premiumChapters';
import { clearPremiumReturn, isPremiumReturnCheckpoint, readPremiumReturn } from '@/lib/premiumReturn';
import { useSession } from '@/state/SessionProvider';

/**
 * Premium 자동 복귀 감시 (v1.47 UT-2 Stability) — `AppShell`에 한 번 붙는다.
 *
 * 입력 보완 화면에서 '정보 채우기'로 나간 사용자가 결과 화면(체크포인트)에 도착했고, 그 시점에
 * **실제로** 근거가 채워졌으면(`hasPremiumEvidence` — Paywall과 같은 판정) 기억해둔 Premium 주소로 되돌린다.
 * 아직 부족하면 아무것도 하지 않는다 — 사용자는 그 화면에서 계속 입력할 수 있고, Premium 진입도 그대로 보인다.
 *
 * ⚠️ 체크포인트가 아니면 판정 훅 자체를 마운트하지 않는다 — 다른 화면에서 계산 · AI 요청이 늘지 않는다.
 */
export function PremiumReturnWatcher() {
  const pathname = usePathname();
  const { hydrated } = useSession();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    setPending(hydrated && isPremiumReturnCheckpoint(pathname) ? readPremiumReturn() : null);
  }, [hydrated, pathname]);

  if (!pending) return null;
  return <PremiumReturnCheck key={`${pathname}:${pending}`} href={pending} />;
}

function PremiumReturnCheck({ href }: { href: string }) {
  const { answers } = useSession();
  const insights = useCrossSourceInsights();
  const mirror = useMirror();
  const navReplace = useNavReplace();
  const doneRef = useRef(false);
  const ready = hasPremiumEvidence({ insights, declared: answers.declared, mirror });

  useEffect(() => {
    if (!ready || doneRef.current) return;
    doneRef.current = true;
    clearPremiumReturn();
    navReplace(href);
  }, [ready, href, navReplace]);

  return null;
}
