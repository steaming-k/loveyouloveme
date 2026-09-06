import { TARGET_MIN_KNOWN } from '@/data/targetFields';
import { targetKnownCount } from '@/lib/validation';
import type { SessionAnswers, SoloMode, TargetProfile } from '@/types';

/**
 * 지금 이 사용자를 **어떤 리포트로 보낼지** (v1.29 · P4 §32~§34)
 *
 * 이 서비스는 지금까지 "상대가 있다"를 전제로 만들어졌다. 상대 정보가 모자라면
 * 동기화율이 `?`가 되고, 관계 경험이 없으면 Mirror가 통째로 비어서 반환된다.
 * 그 상태의 사용자는 결국 **아무것도 못 보고** 홈으로 돌아간다(P4 Audit 실측).
 *
 * P4는 그 사용자에게 다른 리포트를 준다. 그러려면 먼저 **세 상태를 구분**해야 한다 —
 * 하나로 묶으면 카피도 근거도 전부 어긋난다.
 *
 * ⚠️ **새 점수를 만들지 않는다.** 이미 있는 `targetKnownCount` / `TARGET_MIN_KNOWN`만
 * 읽는다. 동기화율·Mirror·History 계산에는 이 값이 들어가지 않는다.
 */

/**
 * 특정 상대를 염두에 두고 있다는 신호가 하나라도 있는가.
 *
 * `relation`은 "이 사람과 나의 **관계 이름**"이다. `unsure`(잘 모름)도 **사람은 있다**는
 * 뜻이라 여기서는 신호로 센다(§33) — 상대의 관계 행동을 모른다는 것은 4축의 `x`가
 * 따로 담당한다.
 */
function hasTargetSignal(target: TargetProfile): boolean {
  return target.relation !== null || targetKnownCount(target) > 0;
}

/**
 * @returns
 *  - `couple` 비교할 만큼 상대를 안다 → 기존 Compatibility 그대로
 *  - `unknown_target` 사람은 있는데 아는 게 적다 → **상대를 추론하지 않고** 알아갈 질문을 준다
 *  - `no_target` 지금 특정 상대가 없다 → 내 기준만으로 First Contact Report
 */
export function soloModeOf(answers: SessionAnswers): SoloMode {
  const { target } = answers;
  if (targetKnownCount(target) >= TARGET_MIN_KNOWN) return 'couple';
  return hasTargetSignal(target) ? 'unknown_target' : 'no_target';
}

/**
 * First Contact Report를 보여줄 상태인가.
 *
 * ⚠️ `couple`이면 false다 — Solo 리포트가 궁합 결과를 대체하지 않는다.
 * 두 리포트가 같은 화면을 두고 다투면 사용자는 무엇을 본 것인지 모른다.
 */
export function isFirstContactMode(answers: SessionAnswers): boolean {
  return soloModeOf(answers) !== 'couple';
}
