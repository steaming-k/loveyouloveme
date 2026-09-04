'use client';

import { Activity, History, House, UserRound } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { revisitHref } from '@/lib/resultView';
import { ROUTES } from '@/lib/routes';
import { useToast } from './ToastProvider';
import { useSession } from '@/state/SessionProvider';

/**
 * Post-analysis IA. 매칭·커뮤니티는 Main Navigation에 넣지 않는다.
 * 아직 기록이 없는 탭은 죽은 버튼으로 두지 않고, 왜 못 들어가는지 알려준다.
 *
 * v1.11 §23 — '나' 탭은 Mirror가 아니라 Relationship Profile(내 관계 프로필)로 향한다.
 * Profile Result가 이미 '현재의 나' 허브 역할(현재 프로필 + 수정 + Mirror 다시 보기 링크)을
 * 하므로, Mirror로 바로 보내는 것보다 여기로 보내는 쪽이 '나'라는 탭 이름과 더 맞는다.
 *
 * '관찰기록' 탭은 History(§27)가 이미 기록 0개 Empty State를 안내하므로 '나'/'분석'과
 * 달리 완료 게이팅 없이 항상 열어둔다 — 기록이 없다는 사실도 History 화면이 직접 말해준다.
 *
 * 활성 표시(§4): '분석' 탭은 이 Nav가 실제로 렌더되는 두 라우트(/compatibility·/mirror)
 * 모두에서 켜진다 — 둘 다 같은 Analysis Mental Model에 속한다.
 */
const TABS = [
  { key: 'home', label: '홈', href: ROUTES.home, Icon: House, activeMatch: [ROUTES.home] },
  {
    key: 'me',
    label: '나',
    href: revisitHref(ROUTES.profileResult, 'direct'),
    Icon: UserRound,
    activeMatch: [ROUTES.profileResult],
  },
  {
    key: 'analysis',
    label: '분석',
    href: ROUTES.compatibility,
    Icon: Activity,
    activeMatch: [ROUTES.compatibility, ROUTES.mirror],
  },
  {
    key: 'history',
    label: '관찰기록',
    href: ROUTES.history,
    Icon: History,
    activeMatch: [ROUTES.history],
  },
] as const;

export function BottomNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { answers } = useSession();
  const { showToast } = useToast();

  const isReady = (key: (typeof TABS)[number]['key']): boolean => {
    if (key === 'home' || key === 'history') return true;
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
        const active = tab.activeMatch.some((route) => pathname === route);
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
