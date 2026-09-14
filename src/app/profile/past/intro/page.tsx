'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

import { useNavReplace } from '@/hooks/useContextualBack';
import { withReturnTo } from '@/lib/returnTo';
import { ROUTES } from '@/lib/routes';

/**
 * S14 과거 관계 인트로 — **260914 UT 후속 P1 STEP 1: 별도 화면을 없앴다.**
 *
 * '이번엔 네 기억을 조금 빌릴게' 화면은 UT에서 느닷없고, 본문과 버튼이 이어지지 않고,
 * 집중이 끊긴다는 반응이 나왔다. 안내 문장과 '연애 경험이 없어' 건너뛰기는 과거 관계
 * 첫 질문(`PastStepView` step 1)으로 옮겼다 — 두 경로(경험 있음 · 없음)는 그대로다.
 *
 * ⚠️ Route는 남긴다. Premium 입력 보완(`PREMIUM_FIX_ROUTE.experience`) · 예전 링크 ·
 * 뒤로가기 fallback이 이 주소를 가리킨다. 들어오면 history를 쌓지 않고 첫 질문으로 보낸다.
 */
export default function PastIntroPage() {
  return (
    <Suspense fallback={null}>
      <PastIntroRedirect />
    </Suspense>
  );
}

function PastIntroRedirect() {
  const navReplace = useNavReplace();
  const searchParams = useSearchParams();

  useEffect(() => {
    navReplace(withReturnTo(ROUTES.past(1), searchParams));
  }, [navReplace, searchParams]);

  return null;
}
