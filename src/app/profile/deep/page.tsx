import { Suspense } from 'react';

import { DeepInputView } from './DeepInputView';

/**
 * S14b Optional Deep Input — **선택형 심화 질문** (260915 UT P1-1)
 *
 * 기본 흐름에는 없는 화면이다. 관계 경험 마지막 단계에서 `+ 더 자세히 알려주기`를
 * 누른 사용자만 도착한다. 여기서 답하지 않아도, 아예 오지 않아도 결과는 그대로 나온다.
 */
export default function ProfileDeepInputPage() {
  /* 복귀 주소(`returnTo`)를 위해 useSearchParams()를 쓴다 */
  return (
    <Suspense fallback={null}>
      <DeepInputView />
    </Suspense>
  );
}
