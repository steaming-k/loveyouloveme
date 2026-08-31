import { SAJU_ENGINE_READY } from '@/lib/env';
import { hasUsableBirthTime, isBirthDateUsable } from '@/lib/logic/birth';
import type {
  BirthProfile,
  SajuCompatibilityResult,
  SajuProfileResult,
} from '@/types';

/**
 * Saju Service — Entertainment Lens
 *
 * ⚠️ **이 파일은 사주 명식을 계산하지 않는다.**
 *
 * 사주 명식 계산은 음력 환산만으로 끝나는 문제가 아니다 — 절입(節入) 시각, 진태양시, 출생지
 * 경도 보정, 연·월주 세우기 규칙이 모두 필요하다. 검증된 계산 엔진/라이브러리/API가 없는
 * 상태에서 생년월일 숫자 더하기·띠·랜덤 테이블로 명식을 만들면 그건 사주가 아니라 거짓이다.
 *
 * 그래서 `SAJU_ENGINE_READY`가 false인 동안은 UI Shell과 Data Contract만 제공하고,
 * `available: false` + `limitations`로 **못 하는 것을 정직하게 알린다.**
 * 정확도 없는 Fake Saju보다 Incomplete but Honest 상태가 낫다.
 *
 * 엔진이 붙으면 이 파일의 두 함수 구현만 교체하면 되고, 화면 코드는 그대로다.
 */

const ENGINE_MISSING =
  '아직 사주 명식 계산 엔진이 연결되지 않았어. 없는 결과를 내가 지어내진 않을게.';
const ENGINE_PLAN =
  '계산 기능이 연결되면 사주 기본 해석 · 관계 성향 해석 · 두 사람 사주 Lens를 제공할 예정이야.';
const NOT_PREDICTION =
  '사주는 전통적인 해석 체계야. 실제 관계가 잘될 확률을 예측하는 결과로는 쓰지 않을게.';

function baseLimitations(profile: BirthProfile): string[] {
  const limitations: string[] = [];

  if (!hasUsableBirthTime(profile)) {
    // 시주(時柱)는 출생 시각 없이는 세울 수 없다. 엔진이 붙어도 이 한계는 남는다.
    limitations.push(
      profile.timeUnknown
        ? '출생 시간을 모른다고 했으니, 시간이 필요한 해석(시주)은 빼고 볼게.'
        : '출생 시간이 없어서 시간이 필요한 해석(시주)은 볼 수 없어.',
    );
  }

  if (profile.calendarType === 'lunar') {
    limitations.push('음력으로 입력했어. 정확한 환산은 계산 엔진이 연결된 뒤에 처리할게.');
  }

  if (!profile.location?.city) {
    limitations.push('출생 지역이 없어서 지역 보정은 반영하지 못해.');
  }

  return limitations;
}

/* ------------------------------------------------------------------ Self */

export function calculateSaju(profile: BirthProfile, today: Date): SajuProfileResult {
  if (!isBirthDateUsable(profile, today)) {
    return {
      available: false,
      limitations: ['생년월일이 있어야 사주를 볼 수 있어.'],
    };
  }

  if (!SAJU_ENGINE_READY) {
    // 명식(pillars)·해석(interpretation)을 **비워서** 돌려준다. 화면은 이 상태를 그대로 보여준다.
    return {
      available: false,
      limitations: [ENGINE_MISSING, ENGINE_PLAN, ...baseLimitations(profile)],
    };
  }

  /* 엔진 연결 지점.
   * 실제 구현은 여기서 검증된 계산기를 호출해 pillars/interpretation을 채운다.
   * 결과 표현은 아래 범위로 제한한다(§13):
   *   ① 전통 해석에서 보는 주요 성향 ② 관계에서 참고해볼 주제 ③ 주의해서 볼 해석 ④ 한계
   * 금지: 결혼운 확정 · 몇 살에 결혼 · 이별/이혼 가능성 · 바람기 · 질병/사망 · 투자운 ·
   *      '너는 반드시 이런 사람' · '이 사람과 결혼하면 안 된다'
   */
  return {
    available: false,
    limitations: [ENGINE_MISSING, ENGINE_PLAN, ...baseLimitations(profile)],
  };
}

/* --------------------------------------------------------------- Couple */

/**
 * 두 사람 사주 Lens.
 * 한쪽 생년월일이라도 없으면 결과를 만들지 않는다. 엔진이 없으면 관찰도 만들지 않는다.
 *
 * ⚠️ 이 결과는 동기화율에 **합산하지 않는다.** `Main Sync Score + Saju Score = 최종 궁합 87점`
 * 같은 형태를 만들지 않는다 — 별도 Entertainment Result다.
 */
export function calculateSajuCompatibility(
  mine: BirthProfile,
  theirs: BirthProfile,
  today: Date,
): SajuCompatibilityResult {
  const mineOk = isBirthDateUsable(mine, today);
  const theirsOk = isBirthDateUsable(theirs, today);

  if (!mineOk || !theirsOk) {
    return {
      available: false,
      observations: [],
      prompts: [],
      limitations: ['두 사람의 생년월일이 모두 있어야 함께 볼 수 있어.'],
    };
  }

  if (!SAJU_ENGINE_READY) {
    return {
      available: false,
      observations: [],
      prompts: [],
      limitations: [
        ENGINE_MISSING,
        ENGINE_PLAN,
        NOT_PREDICTION,
        '네가 입력한 상대 출생정보를 기준으로 볼 예정이야.',
      ],
    };
  }

  /* 엔진 연결 지점 — 관찰은 '비슷하게 읽히는 부분 / 다르게 읽힐 수 있는 부분'과
   * '이야기해볼 주제'로만 구성한다. 점수·확률·궁합 등급을 만들지 않는다. */
  return {
    available: false,
    observations: [],
    prompts: [],
    limitations: [ENGINE_MISSING, ENGINE_PLAN, NOT_PREDICTION],
  };
}

/** 화면에서 '엔진 연결 여부'를 그대로 보여주기 위해 노출한다 */
export const sajuEngineAvailable = SAJU_ENGINE_READY;
