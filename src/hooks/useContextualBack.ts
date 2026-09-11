'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

import { hasInAppHistory, markNavReplace } from '@/lib/navTrail';

/**
 * Contextual Back — **돌아갈 곳은 진입한 곳이다** (v1.46.2 §Navigation)
 *
 * ```
 * 앱 안에서 들어왔다   → router.back()      직전 화면 그대로(쿼리·스크롤 포함)
 * 주소창으로 들어왔다  → router.replace(fallback)
 * ```
 *
 * 화면마다 조건문을 두지 않으려고 훅 하나로 모았다. 실제로 이 훅을 부르는 곳은
 * 대부분 `ScreenHeader` 한 곳이다 — 화면들은 `fallback`만 선언한다.
 *
 * ⚠️ fallback은 **push가 아니라 replace**다. 직접 진입한 화면을 history에 남겨두면
 * fallback으로 간 뒤 브라우저 back이 다시 그 화면으로 돌아와 왕복이 된다(§5).
 *
 * ⚠️ 스크롤 위치는 이 훅이 복원하지 않는다. 돌아간 화면의 `useScrollRestore`가
 * 자기 키로 복원한다 — 복원 책임을 한 곳에 둔다(v1.22 §12).
 */
export function useContextualBack(fallback: string): () => void {
  const router = useRouter();

  return useCallback(() => {
    if (hasInAppHistory()) {
      router.back();
      return;
    }
    markNavReplace();
    router.replace(fallback);
  }, [router, fallback]);
}

/**
 * `router.replace()`를 쓰는 **유일한 통로**.
 *
 * replace는 history 항목을 갈아끼운다 — 가드 redirect(`데이터가 없으면 홈으로`)나
 * 로딩→결과 전환처럼 "그 화면으로 되돌아갈 이유가 없는" 이동에 맞다. 다만 그
 * 사실을 방문 기록기에 알려주지 않으면 방문 깊이가 부풀어, **직접 진입한 화면이
 * '앱 안에서 왔다'로 잘못 판정된다**(`markNavReplace` 주석 참고).
 *
 * 그래서 화면들은 `router.replace`를 직접 부르지 않고 이 훅을 쓴다. 소스 스캔
 * (NAV-13)이 그 규칙을 고정한다.
 */
export function useNavReplace(): (href: string) => void {
  const router = useRouter();

  return useCallback(
    (href: string) => {
      markNavReplace();
      router.replace(href);
    },
    [router],
  );
}
