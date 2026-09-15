import { Suspense } from 'react';

import { HydrationGate } from '@/components/common/HydrationGate';

import { DeepInputView } from './DeepInputView';

/**
 * S14b Optional Deep Input — **선택형 심화 질문** (260915 UT P1-1)
 *
 * 기본 흐름에는 없는 화면이다. 관계 경험 마지막 단계에서 `+ 더 자세히 알려주기`를
 * 누른 사용자만 도착한다. 여기서 답하지 않아도, 아예 오지 않아도 결과는 그대로 나온다.
 *
 * ══ UT-2 RC Blocker — **새로고침하면 질문이 사라졌다** ══════════════════════
 *
 * `DeepInputView`는 질문 목록을 **마운트 시점에 한 번 고정한다**
 * (`useState(() => selectDeepInputQuestions(answers))`). 답할 때마다 다시 고르면
 * 방금 답한 질문이 목록에서 빠져 화면이 갈아엎어지기 때문이고, 그 판단은 옳다.
 *
 * 그런데 이 화면에는 `HydrationGate`가 없었다. 새로고침이나 주소 직접 진입에서는
 * 세션 복원 **전에** 첫 렌더가 돌고, 그때 `answers`는 빈 기본값이다 — `experience` ·
 * `declared`가 전부 null이라 `selectDeepInputQuestions`가 빈 배열을 돌려주고, 그
 * 값이 그대로 고정된다. 결과는 세션에 답이 다 있는데도 화면은
 * "더 물어볼 건 관계 이야기가 쌓이면 그때 물어볼게"만 보여주는 dead-end였다.
 *
 * 2차 UT에서 이건 조용한 오염이다: 참가자가 심화 입력을 **안 쓴 것**으로 보이지만
 * 실제로는 화면이 질문을 준 적이 없다 — H1이 재려는 바로 그 행동이 사라진다.
 *
 * ⚠️ **freeze 자체는 고치지 않는다.** 고쳐야 할 것은 freeze가 아니라 *언제* freeze
 * 하느냐다. 나머지 18개 결과 화면과 같은 `HydrationGate`를 써서, 복원이 끝난 뒤에
 * 첫 렌더가 일어나게 한다 — 새 패턴을 만들지 않는다.
 */
export default function ProfileDeepInputPage() {
  /* 복귀 주소(`returnTo`)를 위해 useSearchParams()를 쓴다 */
  return (
    <HydrationGate>
      <Suspense fallback={null}>
        <DeepInputView />
      </Suspense>
    </HydrationGate>
  );
}
