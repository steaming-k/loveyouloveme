import type { MirrorInsight } from '@/types';

/**
 * Presentation Priority — **무엇을 먼저 보여줄지만 정한다** (v1.46.4 · §13 · §14)
 *
 * ══ 왜 판정 파일이 아니라 여기인가 ════════════════════════════════════════
 *
 * UT-1의 지적은 "이미 아는 내용을 다시 읽는다"였다. Mirror 실측에서 고데이터 세션의
 * 네 축 중 셋이 `MATCH`였고, 그 세 행이 **화면 맨 위에 차례로** 놓여 있었다. 사용자가
 * 처음 읽는 세 문단이 전부 '네가 말한 대로였어'였다는 뜻이다.
 *
 * 고쳐야 할 것은 판정이 아니라 **순서**다. `MATCH`가 틀린 판정이 아니고, 없애서도 안
 * 된다(일치도 관찰 결과다). 새로 알게 되는 것부터 보여주고 이미 아는 것은 뒤에
 * 짧게 두면 된다.
 *
 * ⚠️ **판정·점수·근거를 바꾸지 않는다.** 이 파일은 배열 순서만 만든다. 그래서
 * `logic/mirror.ts`(판정)에 넣지 않았다 — 판정 파일에 표현 규칙이 섞이면 다음 사람이
 * 순서를 바꾸려다 판정을 건드린다.
 *
 * ⚠️ **행을 지우지 않는다.** 정렬만 한다. 필터링은 사용자가 자기 결과의 일부를 못 보게
 * 만드는 일이고, 그건 이 제품이 하지 않는다.
 */

/**
 * §14 — 새로 알게 되는 판정이 먼저, 이미 아는 판정이 나중.
 *
 * ```
 * 1  GAP      말한 기준보다 크게 반응한 자리   — 이번에 새로 보이는 것
 * 2  CHANGE   두 시점이 다르게 나온 자리       — 비교해야만 보이는 것
 * 3  MATCH    말한 대로였던 자리               — 이미 알고 있던 것
 * ```
 *
 * ⚠️ **같은 등급 안에서는 원래 순서를 유지한다**(stable). 판정 엔진이 정한 축 순서를
 * 여기서 다시 흔들면, 같은 세션을 두 번 열었을 때 행 순서가 달라 보일 수 있다.
 */
const STATE_RANK: Record<string, number> = { GAP: 0, CHANGE: 1, MATCH: 2 };

export function orderMirrorInsightsForDisplay(
  insights: readonly MirrorInsight[],
): MirrorInsight[] {
  return [...insights]
    .map((insight, index) => ({ insight, index }))
    .sort((a, b) => {
      const rank = (STATE_RANK[a.insight.state] ?? 1) - (STATE_RANK[b.insight.state] ?? 1);
      return rank !== 0 ? rank : a.index - b.index;
    })
    .map((item) => item.insight);
}

/**
 * §13 — 이 행을 **짧게 접어도 되는가**.
 *
 * `MATCH`는 "말한 기준과 관계에서 나타난 신호가 같은 방향"이라는 판정이다. 사용자가
 * 이미 알고 있는 내용이므로 길게 설명하지 않는다 — 한 줄로 말하고, 근거는 펼치면
 * 보인다. 정보를 빼는 게 아니라 **위계를 만드는 것**이다(v1.23 §9와 같은 판단).
 */
export function isAlreadyKnown(insight: MirrorInsight): boolean {
  return insight.state === 'MATCH';
}

/** §13 — MATCH 행의 한 줄. 사용자별로 달라지지 않는 고정 문구다 */
export const ALREADY_KNOWN_LINE = '이미 알고 있던 기준이야 — 말한 기준과 같은 방향으로 나왔어.';
