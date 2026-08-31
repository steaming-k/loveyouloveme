'use client';

import type { ReactNode } from 'react';

import { Lovy } from '@/components/lovy/Lovy';
import { useHistory } from '@/state/HistoryProvider';
import { useSession } from '@/state/SessionProvider';

/**
 * 결과 화면 전용 게이트
 *
 * 답변은 localStorage에서 복원되므로, 복원 전에는 '입력이 하나도 없는 상태'로 계산된다.
 * 그대로 렌더하면 새로고침할 때마다 빈 결과가 한 번 스쳐 보인다.
 * 서버 렌더 결과와 첫 클라이언트 렌더를 같게 유지하면서 그 깜빡임만 없앤다.
 *
 * History도 같은 저장소에서 복원되므로 함께 기다린다 — 복원 전에 렌더하면 기록이 있는데도
 * '아직 저장된 관찰이 없어'가 한 번 스쳐 보이거나, 리다이렉트 가드가 잘못 발동한다.
 */
export function HydrationGate({ children }: { children: ReactNode }) {
  const { hydrated } = useSession();
  const { hydrated: historyHydrated } = useHistory();

  if (!hydrated || !historyHydrated) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3" aria-busy>
        <Lovy pose="crystal" size={84} decorative />
        <p className="text-meta text-ink-faint">관측 기록을 불러오는 중</p>
      </div>
    );
  }

  return <>{children}</>;
}
