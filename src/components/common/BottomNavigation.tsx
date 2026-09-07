'use client';

import { Activity, History, House, UserRound } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { revisitHref } from '@/lib/resultView';
import { resolveRelationshipStage } from '@/lib/logic/relationshipStage';
import { soloModeOf } from '@/lib/logic/soloMode';
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
    /**
     * v1.29 P4 §46 — **새 탭을 만들지 않는다.** First Contact Report도 같은 Analysis
     * Mental Model이라 이 탭이 함께 담당한다. 실제 목적지는 상대 정보량에 따라
     * `handlePress`에서 갈린다 — 상대를 비교할 수 없는 사용자를 `?`가 뜨는
     * `/compatibility`로 보내지 않는다.
     */
    href: ROUTES.compatibility,
    Icon: Activity,
    activeMatch: [ROUTES.compatibility, ROUTES.mirror, ROUTES.firstContact],
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

  /**
   * v1.29 P4 — Solo 사용자의 '분석' 탭.
   *
   * v1.28까지 이 탭은 `completed.compatibility` 하나로만 열렸고, 열리면 무조건
   * `/compatibility`로 갔다. 상대를 비교할 수 없는 사용자에게는 **열려도 `?`뿐이고,
   * 안 열리면 "상대를 먼저 알려줘"라는 잠긴 문구뿐**이었다 — 둘 다 막힌 길이다.
   *
   * 이제 상대 정보가 모자라면 First Contact Report로 보낸다. 그러면 이 탭의 조건도
   * 달라진다 — Solo 리포트는 상대가 아니라 **내 기준**만 필요하므로
   * `completed.profile`이 기준이다.
   */
  const solo = soloModeOf(answers) !== 'couple';

  /*
    v1.40 §37.15 — `ended`의 '분석'은 궁합이 아니다.

    관계가 끝난 사용자의 Job은 회고이고(REFLECT → UNDERSTAND → CARRY FORWARD), 그 답을
    주는 화면은 '우리 둘은 얼마나 맞나'가 아니라 '나는 관계에서 어떤 사람이었나'를 다루는
    Mirror다. 그래서 **목적지만** 바꾼다 — 새 Route를 만들지 않았고, Compatibility 결과는
    Home의 '최근 분석'에서 여전히 열 수 있다.

    ⚠️ 조건도 `completed.profile`이다. Mirror는 내 답변만으로 만들어지므로 상대 입력
    완료(`completed.compatibility`)를 요구할 이유가 없다 — solo와 같은 이유다.
  */
  const reflecting = resolveRelationshipStage(answers.status) === 'ended';
  const analysisHref = reflecting
    ? ROUTES.mirror
    : solo
      ? ROUTES.firstContact
      : ROUTES.compatibility;
  const selfOnlyAnalysis = solo || reflecting;

  const isReady = (key: (typeof TABS)[number]['key']): boolean => {
    if (key === 'home' || key === 'history') return true;
    if (key === 'me') return answers.completed.profile;
    return selfOnlyAnalysis ? answers.completed.profile : answers.completed.compatibility;
  };

  const handlePress = (tab: (typeof TABS)[number]) => {
    if (!isReady(tab.key)) {
      showToast(
        tab.key === 'me' || selfOnlyAnalysis
          ? '관찰 기록을 먼저 만들어야 볼 수 있어.'
          : '아직 궁합 관측 기록이 없어. 상대를 먼저 알려줘.',
        'warning',
      );
      return;
    }
    router.push(tab.key === 'analysis' ? analysisHref : tab.href);
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
