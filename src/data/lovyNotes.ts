import type { CompatibilityResult, TargetAxisKey } from '@/types';

/**
 * 러비 관찰 노트 (v1.20)
 *
 * 화면 곳곳에 감성 문구를 하드코딩해 흩뿌리지 않는다. 여기 한 곳에 `trigger × axis`로
 * 등록하고 현재 결과에서 **결정론적으로** 고른다 — 같은 결과면 언제나 같은 문장이다
 * (랜덤 생성 금지). QA에서 재현되고, 사용자가 두 번 봐도 말이 바뀌지 않는다.
 *
 * ⚠️ 이 문장들은 **결과를 만들지 않는다.** 이미 계산이 끝난 `CompatibilityResult`를 보고
 * 러비가 떠올린 '생각/질문'일 뿐이다 — Compatibility Score·4축 계산·tone 판정은 이
 * 파일을 읽지도 않는다.
 *
 * 화법 규칙 (러비 Monologue):
 *   - 인간을 처음 보는 외계인의 호기심. 짧은 혼잣말.
 *   - '~일 수도 있겠네' / '~인가 봐' / '~구나'
 *   - 금지: '당신은 ~한 사람입니다' · '이 관계는 성공할 확률이 ~' ·
 *          '심리학적으로 ~' 같은 아는 척과 단정.
 */
export type LovyNoteTrigger =
  | 'compatibility_gap'
  | 'compatibility_alignment'
  | 'lens_bridge';

export interface LovyObservationNote {
  id: string;
  trigger: LovyNoteTrigger;
  /** 이 노트가 붙는 관계 축. 없으면 축과 무관한 기본 노트다. */
  axis?: TargetAxisKey;
  text: string;
}

export const LOVY_OBSERVATION_NOTES: readonly LovyObservationNote[] = [
  /* 차이가 보이는 축 — '누가 맞다'가 아니라 '같은 말이 서로 다르게 번역된다' */
  {
    id: 'gap-conflict',
    trigger: 'compatibility_gap',
    axis: 'conflict',
    text: '둘 다 갈등을 풀고 싶은 건 같아 보이는데, 한 사람에게 푼다는 건 바로 이야기하는 거고 다른 사람에게는 생각할 시간을 갖는 걸 수도 있네.',
  },
  {
    id: 'gap-alone',
    trigger: 'compatibility_gap',
    axis: 'alone',
    text: '같이 있고 싶은 마음과 혼자 있을 시간이 필요한 마음은, 꼭 반대말은 아닌가 봐.',
  },
  {
    id: 'gap-contact',
    trigger: 'compatibility_gap',
    axis: 'contact',
    text: '연락을 몇 번 하느냐보다, 연락이 없을 때 그걸 무엇이라고 받아들이는지가 더 중요할 수도 있겠네.',
  },
  {
    id: 'gap-affection',
    trigger: 'compatibility_gap',
    axis: 'affection',
    text: '표현의 양이 마음의 크기와 같은 말은 아닐 수도 있겠다. 인간은 같은 표현도 서로 다르게 번역하는구나.',
  },

  /* 어긋나는 축을 못 찾았을 때 — 억지로 '둘이 다르다'고 말하지 않는다 */
  {
    id: 'align-conflict',
    trigger: 'compatibility_alignment',
    axis: 'conflict',
    text: '이야기를 꺼내는 시점은 비슷하네. 언제 꺼내느냐가 같다고 무엇을 꺼내느냐까지 같은 건 아닐 텐데.',
  },
  {
    id: 'align-alone',
    trigger: 'compatibility_alignment',
    axis: 'alone',
    text: '혼자 있는 시간에 대한 기대는 비슷해 보여. 근데 혼자 있고 싶은 이유까지 같은지는 나도 모르겠어.',
  },
  {
    id: 'align-contact',
    trigger: 'compatibility_alignment',
    axis: 'contact',
    text: '연락에 대한 기대는 비슷하게 답했네. 같은 빈도를 두 사람이 같은 뜻으로 읽고 있는지는 아직 못 봤어.',
  },
  {
    id: 'align-affection',
    trigger: 'compatibility_alignment',
    axis: 'affection',
    text: '표현의 양은 비슷한 편이야. 어떤 표현을 애정이라고 부르는지는 사람마다 다르던데.',
  },
  {
    id: 'align-default',
    trigger: 'compatibility_alignment',
    text: '지금 입력에서는 크게 어긋나는 축을 못 찾았어. 근데 비슷하다는 게 같다는 뜻은 아니라서, 나는 아직 궁금해.',
  },

  /* Lens → Core Bridge (§12). 계산은 건드리지 않고 연결만 만든다. */
  {
    id: 'bridge-lens',
    trigger: 'lens_bridge',
    text: '이 렌즈에서는 이렇게 보여. 그런데 실제 관계에서는 어떨까?',
  },
];

function findNote(
  trigger: LovyNoteTrigger,
  axis?: TargetAxisKey,
): LovyObservationNote | undefined {
  return LOVY_OBSERVATION_NOTES.find(
    (note) => note.trigger === trigger && note.axis === axis,
  );
}

/**
 * 현재 궁합 결과에 맞는 관찰 노트 하나.
 *
 * 우선순위: 가장 차이가 큰 축(friction) → 가장 잘 맞는 축(alignment) → 기본 노트.
 * `score === null`(관측 정보 부족, E3)이면 **아무 것도 만들지 않는다** — 데이터가 없는데
 * 사람에 대한 생각을 지어내지 않기 위해서다.
 */
export function selectCompatibilityNote(
  result: CompatibilityResult,
): LovyObservationNote | null {
  if (result.score === null) return null;

  const gapAxis = result.frictionSignals[0]?.key;
  if (gapAxis) return findNote('compatibility_gap', gapAxis) ?? null;

  const alignAxis = result.goodSignals[0]?.key;
  return (
    (alignAxis ? findNote('compatibility_alignment', alignAxis) : undefined) ??
    findNote('compatibility_alignment') ??
    null
  );
}

export function lensBridgeNote(): LovyObservationNote {
  // 등록된 상수라 항상 존재한다. 없으면 타입이 아니라 데이터가 깨진 것이다.
  return findNote('lens_bridge') as LovyObservationNote;
}

/* ------------------------------------------------------------ FIRST SURPRISE */

/**
 * FIRST SURPRISE (§2/§11)
 *
 * 무료 궁합 결과를 이해한 **직후**에 한 번만 나오는 인식 전환 지점.
 * "궁합 점수를 주는 서비스인 줄 알았는데, 관계를 보는 방식이 다르네"를 만드는 게 목적이다.
 *
 * ⚠️ Premium 광고가 아니다. 가격·CTA·잠금 표현을 넣지 않는다.
 * ⚠️ '하나의 렌즈로 설명하지 않는다'는 문장을 그대로 반복하지 않는다 — 러비의 관찰로 말한다.
 */
export interface LovySurprise {
  /** Analytics에 보내는 opaque variant. 문구 원문은 절대 보내지 않는다. */
  variant: 'gap' | 'alignment';
  /** 러비의 짧은 혼잣말 */
  hook: string;
  /** 이어지는 설명 — 여전히 러비 화법이되 차분하게 */
  body: string;
}

export function selectFirstSurprise(result: CompatibilityResult): LovySurprise | null {
  if (result.score === null) return null;

  if (result.frictionSignals.length > 0) {
    return {
      variant: 'gap',
      hook: '잠깐. 숫자만 보면 놓치는 게 하나 있어.',
      body: '같은 유형이거나 비슷한 성향이어도, 실제 관계에서는 연락·갈등·개인 시간처럼 서로 다르게 받아들이는 순간이 생기더라. 그래서 나는 두 사람을 숫자 하나로 설명하지 않고 축을 하나씩 따로 봐.',
    };
  }

  return {
    variant: 'alignment',
    hook: '잠깐. 잘 맞는다고 나와도 확인은 필요해.',
    body: '지금 입력에서는 크게 어긋나는 축이 안 보여. 근데 비슷하게 답했다고 같은 뜻으로 답한 건 아닐 수 있어서, 나는 축을 하나씩 따로 봐.',
  };
}
