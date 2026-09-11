import type { PremiumLensKind } from '@/types';

/**
 * Premium Lens AI — **어휘 상수** (v1.46 AI Lens · §6 · §9~§17 · §30 · §32)
 *
 * ══ 이 파일이 존재하는 이유 ═══════════════════════════════════════════════
 *
 * v1.42 §41.14의 사건이 이 파일의 이유 전부다. 모델이 식별자를 자유롭게 짓게 두면
 * (`raw=1[연락] allowed=[contact] parsed=0`) 파서가 전부 걸러 화면에 한 문장도 닿지
 * 않는다. 그때 정한 방향은 **파서에 별칭을 늘리지 않고 모델이 받는 어휘를 canonical
 * key로 맞춘다**였다.
 *
 * 그래서 여기 있는 것은 세 곳이 **같은 상수**를 보게 하는 표다:
 *
 * ```
 * 프롬프트   허용 id 목록을 그대로 박는다      promptTemplates.ts
 * 파서       oneOf(허용 id)                    schemas.ts
 * 화면       id → 제목                          PremiumLensSection.tsx
 * ```
 *
 * ══ 왜 제목을 모델에게 받지 않는가 ════════════════════════════════════════
 *
 * 모델은 `id`와 `body`만 만든다. 제목은 이 표에서 온다.
 *
 * | | 무엇을 하나 | 왜 아닌가 / 왜 맞나 |
 * |---|---|---|
 * | A | 모델이 제목도 쓴다 | 여섯 칸 제목이 매번 달라져 같은 리포트를 두 번 열면 다른 목차가 된다. 출력 토큰도 그만큼 늘고, 제목에 금지 표현이 들어갈 자리가 하나 더 생긴다 |
 * | B | 제목은 상수, 본문만 모델 | **채택.** 구조는 우리가 정하고 해석만 AI가 한다 — §7 `AI_OUTPUT ⊆ DETERMINISTIC_LENS_EVIDENCE`의 구조 버전이다 |
 *
 * ⚠️ **결정론 섹션 제목과 겹치지 않게 지었다.** 같은 카드 안에서 위(결정론)와
 * 아래(AI)가 같은 제목을 달면 사용자는 같은 내용이 두 번 있다고 읽는다(§31).
 */

/** §30 — AI 블록의 라벨. '러비가 연결해서 보면' 아래에 narrative가 온다 */
export const LENS_AI_COPY = {
  blockLabel: '러비가 연결해서 보면',
  /**
   * §32 — **해당 렌즈만** 이 문구로 바뀐다. 전체 Premium error 화면으로 넘어가지 않는다.
   * 그래서 문장이 사과문이 아니라 '기본 분석은 그대로'라는 사실을 먼저 말한다.
   */
  failed: '러비의 추가 해석을 불러오지 못했어. 기본 분석은 그대로 볼 수 있어.',
  loading: '러비가 이 렌즈를 다시 읽고 있어…',
  retry: '다시 시도',
  /**
   * ⚠️ 아래 세 라벨은 **결정론 Cross-Lens 카드의 라벨과 일부러 다르게** 지었다.
   *
   * 브라우저 실측에서 두 블록이 위아래로 붙어 '반복해서 나온 테마 / 렌즈마다 다르게
   * 말하는 부분 / 실제 관계에서 확인할 것'을 각각 두 번 말했다. 내용은 다른데
   * (위는 테마를 **센** 결과, 아래는 그것을 **풀어 쓴** 문장) 제목이 거의 같아서
   * 같은 말을 두 번 하는 것으로 읽힌다(§31).
   *
   * 그래서 라벨이 관계를 드러낸다 — 위에서 센 것을 아래에서 푼다.
   */
  crossLabel: '러비가 세 렌즈를 겹쳐 보면',
  crossIntro: '위에서 센 테마를 문장으로 이어 봤어.',
  crossRepeated: '반복된 테마를 풀어 보면',
  crossDifference: '다르게 읽히는 지점을 풀어 보면',
  crossQuestion: '대화에서 꺼내볼 것',
} as const;

/**
 * 렌즈 × mode 별 **허용 unit id와 제목** (§9 · §10 · §12 · §13 · §16 · §17).
 *
 * ⚠️ 순서가 화면 순서다. 모델이 순서를 바꿔 보내도 이 배열 순서로 다시 정렬한다 —
 * 목차가 호출마다 달라지지 않게 한다.
 *
 * ⚠️ §27 상한(4~6)을 이 표가 지킨다. 여기 없는 id는 파서가 버리므로 모델이 유닛을
 * 더 만들 방법이 없다.
 */
export interface LensAiUnitSpec {
  id: string;
  title: string;
  /** 프롬프트에 그대로 들어가는 '이 칸에 무엇을 쓰는가' 한 줄 */
  ask: string;
}

type LensAiUnitTable = Record<PremiumLensKind, Record<'pair' | 'self', readonly LensAiUnitSpec[]>>;

export const LENS_AI_UNITS: LensAiUnitTable = {
  mbti: {
    /** §9 — 타입 설명이 아니라 '정보 처리·판단·리듬 차이가 관계에서 어떻게 보이는가' */
    pair: [
      {
        id: 'mbti_pair_rhythm',
        title: '둘의 관계 리듬',
        ask: '두 사람의 에너지 방향과 생활 정리 방식이 함께 지내는 리듬에서 어떻게 다르게 보일 수 있는지.',
      },
      {
        id: 'mbti_pair_dialogue',
        title: '대화와 이해가 오가는 방식',
        ask: '정보를 받아들이는 방식과 결정을 내리는 기준이 대화에서 어떻게 어긋날 수 있는지.',
      },
      {
        id: 'mbti_pair_fit',
        title: '편하게 맞을 수 있는 부분',
        ask: '같은 축에서 오는 편안함. 같은 축이 없으면 없다고 쓴다.',
      },
      {
        id: 'mbti_pair_misread',
        title: '오해가 생기기 쉬운 자리',
        ask: '차이 자체가 아니라, 그 차이를 서로 무엇으로 잘못 읽기 쉬운지.',
      },
      {
        id: 'mbti_pair_verify',
        title: '실제로 확인해볼 것',
        ask: '이 해석이 맞는지 실제 관계에서 확인할 수 있는 구체적인 장면 하나.',
      },
    ],
    /** §10 — '관계 속의 나'. 타입 설명으로 끝내지 않는다 */
    self: [
      {
        id: 'mbti_self_energy',
        title: '관계에서 에너지를 쓰는 방식',
        ask: '가까워질 때 에너지를 어디에 쓰고 어디서 회복하는 쪽으로 분류되는지.',
      },
      {
        id: 'mbti_self_signal',
        title: '상대 신호를 받아들이는 방식',
        ask: '상대가 보내는 신호를 어떤 정보로 먼저 받는 쪽으로 분류되는지.',
      },
      {
        id: 'mbti_self_conflict',
        title: '갈등에서 먼저 잡는 것',
        ask: '갈등 상황에서 판단과 공감 중 무엇을 먼저 잡는 쪽으로 분류되는지.',
      },
      {
        id: 'mbti_self_rhythm',
        title: '계획 · 거리 · 일상 리듬',
        ask: '일상을 정리하는 방식이 관계의 거리 조절에서 어떻게 나타날 수 있는지.',
      },
      {
        id: 'mbti_self_tension',
        title: '내 안에서 부딪히는 지점',
        ask: '내 preference끼리 서로 다른 방향을 가리키는 자리. 없으면 없다고 쓴다.',
      },
      {
        id: 'mbti_self_verify',
        title: '실제 관계에서 검증할 질문',
        ask: '이 분류가 실제 나와 맞는지 스스로 확인할 수 있는 질문 하나.',
      },
    ],
  },

  saju: {
    /** §12 — 전통적 관계 해석 프레임. 운명 예측이 아니다 */
    pair: [
      {
        id: 'saju_pair_mine',
        title: '내 일간이 말하는 관계 테마',
        ask: '내 일간의 오행과 음양이 전통 해석에서 관계를 어떤 테마로 읽게 하는지.',
      },
      {
        id: 'saju_pair_theirs',
        title: '상대 일간이 말하는 관계 테마',
        ask: '상대 일간의 오행과 음양이 같은 프레임에서 어떤 테마로 읽히는지.',
      },
      {
        id: 'saju_pair_together',
        title: '두 일간을 같이 놓았을 때',
        ask: '두 일간 사이의 생극 방향이 관계의 리듬 이야기로 어떻게 읽히는지.',
      },
      {
        id: 'saju_pair_surface',
        title: '차이가 드러날 수 있는 장면',
        ask: '그 방향 차이가 실제 관계의 어떤 순간에 눈에 띌 수 있는지.',
      },
      {
        id: 'saju_pair_unknown',
        title: '이 해석만으로 알 수 없는 것',
        ask: '일주 하나로는 닿지 않는 범위. 계산하지 않은 기둥을 아는 척하지 않는다.',
      },
      {
        id: 'saju_pair_verify',
        title: '실제로 확인해볼 질문',
        ask: '이 방향이 실제로 그런지 확인할 수 있는 질문 하나.',
      },
    ],
    /** §13 — 사주 관점에서 보는 '관계 기준의 나' */
    self: [
      {
        id: 'saju_self_structure',
        title: '지금 계산된 기본 구조',
        ask: '일간의 오행과 음양이 무엇을 가리키는 자리로 분류되는지.',
      },
      {
        id: 'saju_self_theme',
        title: '관계에서 반복해서 볼 만한 테마',
        ask: '그 구조가 전통 해석에서 관계의 어떤 테마와 연결돼 이야기되는지.',
      },
      {
        id: 'saju_self_rhythm',
        title: '편하다고 느낄 수 있는 관계 리듬',
        ask: '어떤 리듬을 편하게 느끼는 쪽으로 읽히는지. 단정하지 않는다.',
      },
      {
        id: 'saju_self_declared',
        title: '내 답과 같이 볼 때',
        ask: '사용자가 직접 답한 내용과 이 프레임이 겹치는 자리와 어긋나는 자리. 답이 우선이다.',
      },
      {
        id: 'saju_self_unknown',
        title: '이 렌즈만으로는 알 수 없는 것',
        ask: '일주 하나가 닿지 않는 범위.',
      },
      {
        id: 'saju_self_verify',
        title: '실제 관계에서 확인할 질문',
        ask: '이 읽기가 실제 나와 맞는지 확인할 수 있는 질문 하나.',
      },
    ],
  },

  zodiac: {
    /** §16 — 'OO자리는 이런 사람'이 아니라 관계 기대와 표현 방식의 차이 */
    pair: [
      {
        id: 'zodiac_pair_style',
        title: '두 사람의 관계 스타일',
        ask: '두 사인의 원소와 양태가 관계를 대하는 방식을 어떤 상징으로 말하는지.',
      },
      {
        id: 'zodiac_pair_common',
        title: '겹치는 자리',
        ask: '두 사인이 같은 방향을 보는 지점. 없으면 없다고 쓴다.',
      },
      {
        id: 'zodiac_pair_expectation',
        title: '서로 다른 기대',
        ask: '관계에서 기대하는 것이 어떻게 다르게 상징되는지.',
      },
      {
        id: 'zodiac_pair_closeness',
        title: '가까워질 때 드러날 수 있는 차이',
        ask: '거리가 좁혀질수록 눈에 띌 수 있는 표현 방식의 차이.',
      },
      {
        id: 'zodiac_pair_misread',
        title: '오해가 생기기 쉬운 자리',
        ask: '그 차이를 서로 무엇으로 잘못 읽기 쉬운지.',
      },
      {
        id: 'zodiac_pair_verify',
        title: '실제로 확인해볼 것',
        ask: '이 상징이 실제 관계와 맞는지 확인할 장면 하나.',
      },
    ],
    /** §17 — 별자리로 보는 관계 속의 나 */
    self: [
      {
        id: 'zodiac_self_theme',
        title: '관계에서 중요하게 볼 수 있는 테마',
        ask: '내 사인의 원소와 양태가 관계에서 무엇을 중요하게 보는 상징으로 읽히는지.',
      },
      {
        id: 'zodiac_self_closeness',
        title: '가까워지는 방식',
        ask: '가까워질 때 어떤 속도와 방식으로 다가가는 쪽으로 상징되는지.',
      },
      {
        id: 'zodiac_self_distance',
        title: '거리와 표현을 보는 관점',
        ask: '거리를 두는 방식과 표현을 꺼내는 방식이 어떻게 상징되는지.',
      },
      {
        id: 'zodiac_self_declared',
        title: '내 답과 비슷한 지점 · 다른 지점',
        ask: '사용자가 직접 답한 내용과 겹치는 자리와 어긋나는 자리. 답이 우선이다.',
      },
      {
        id: 'zodiac_self_verify',
        title: '실제 관계에서 확인할 것',
        ask: '이 상징이 실제 나와 맞는지 확인할 질문 하나.',
      },
    ],
  },
};

export function lensAiUnitsFor(
  kind: PremiumLensKind,
  mode: 'pair' | 'self',
): readonly LensAiUnitSpec[] {
  return LENS_AI_UNITS[kind][mode];
}

/** 파서가 쓰는 허용 id 집합. 프롬프트가 박는 목록과 **같은 배열에서 나온다** */
export function lensAiUnitIds(kind: PremiumLensKind, mode: 'pair' | 'self'): readonly string[] {
  return lensAiUnitsFor(kind, mode).map((unit) => unit.id);
}

/** 화면이 id로 제목을 찾는다. 모델은 제목을 만들지 않는다 */
export function lensAiUnitTitle(
  kind: PremiumLensKind,
  mode: 'pair' | 'self',
  id: string,
): string | null {
  return lensAiUnitsFor(kind, mode).find((unit) => unit.id === id)?.title ?? null;
}
