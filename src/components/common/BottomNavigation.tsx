'use client';

import { Activity, House, UserRound } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { revisitHref } from '@/lib/resultView';
import { ROUTES } from '@/lib/routes';
import { useToast } from './ToastProvider';
import { useSession } from '@/state/SessionProvider';

/**
 * MVP는 3탭. 매칭·커뮤니티·Relationship History는 Main Navigation에 넣지 않는다.
 * 아직 기록이 없는 탭은 죽은 버튼으로 두지 않고, 왜 못 들어가는지 알려준다.
 *
 * v1.11 §23 — '나' 탭은 Mirror가 아니라 Relationship Profile(내 관계 프로필)로 향한다.
 * Profile Result가 이미 '현재의 나' 허브 역할(현재 프로필 + 수정 + Mirror 다시 보기 링크)을
 * 하므로, Mirror로 바로 보내는 것보다 여기로 보내는 쪽이 '나'라는 탭 이름과 더 맞는다.
 * Bottom Nav 구조(3탭)·`isReady` 게이팅은 그대로 두고 target 한 줄만 바꾼다.
 */
const TABS = [
  { key: 'home', label: '홈', href: ROUTES.home, Icon: House },
  { key: 'me', label: '나', href: revisitHref(ROUTES.profileResult, 'direct'), Icon: UserRound },
  { key: 'analysis', label: '분석', href: ROUTES.compatibility, Icon: Activity },
] as const;

export function BottomNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { answers } = useSession();
  const { showToast } = useToast();

  const isReady = (key: (typeof TABS)[number]['key']): boolean => {
    if (key === 'home') return true;
    if (key === 'me') return answers.completed.profile;
    return answers.completed.compatibility;
  };

  const handlePress = (tab: (typeof TABS)[number]) => {
    if (!isReady(tab.key)) {
      showToast(
        tab.key === 'me'
          ? '관찰 기록을 먼저 만들어야 볼 수 있어.'
          : '아직 궁합 관측 기록이 없어. 상대를 먼저 알려줘.',
        'warning',
      );
      return;
    }
    router.push(tab.href);
  };

  return (
    <nav
      className="flex flex-none border-t border-line bg-surface pt-2.5 pb-6"
      aria-label="주요 메뉴"
    >
      {TABS.map((tab) => {
        // v1.11 — 'me' 탭 href에는 `?view=revisit`이 붙어 있어 순수 pathname과 다르다.
        // 활성 표시는 쿼리 없는 경로만 비교한다.
        const active = pathname === tab.href.split('?')[0];
        const ready = isReady(tab.key);

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => handlePress(tab)}
            aria-current={active ? 'page' : undefined}
            className="flex min-h-11 flex-1 flex-col items-center gap-1.5"
          >
            <tab.Icon
              size={20}
              strokeWidth={active ? 2.4 : 1.8}
              className={cn(
                active ? 'text-brand' : ready ? 'text-ink-faint' : 'text-line-strong',
              )}
              aria-hidden
            />
            <span
              className={cn(
                'text-[11px]',
                active ? 'font-semibold text-brand' : ready ? 'text-ink-muted' : 'text-line-strong',
              )}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
