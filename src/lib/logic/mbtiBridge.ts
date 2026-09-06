import { MBTI_AXES } from '@/data/mbti';
import type {
  CompatibilityDimension,
  CompatibilityResult,
  MbtiAxisBridge,
  MbtiAxisKey,
  MbtiBridgeReport,
  MbtiBridgeState,
  MbtiBridgeSurprise,
  MbtiLensReport,
  MbtiPatternBridge,
  MbtiUnmappedAxis,
  TargetAxisKey,
} from '@/types';

/**
 * MBTI × Relationship Signal Bridge (v1.24 · P3-1)
 *
 * 이 파일이 P3-1의 핵심이다. 하지만 **예측이 아니라 비교**만 한다.
 *
 *   MBTI 렌즈에서는 이렇게 보인다
 *   → 네가 실제로 답한 관계 신호에서는 이렇게 나왔다
 *   → 두 관점이 같은 방향인가, 다른 방향인가
 *
 * ⚠️ 절대 하지 않는 것
 *   - 새 점수를 만들지 않는다. `CompatibilityResult`(동기화율·tone 판정)와
 *     `MbtiLensReport`(축별 같음/다름)를 **읽기만** 한다 — 이 파일은 두 계산 중
 *     어느 것도 다시 호출하지 않고, 어느 값도 바꾸지 않는다.
 *   - MBTI 선호 지표를 관계 행동의 **원인**으로 말하지 않는다. 'I니까 개인 시간이
 *     필요하다'가 아니라 '성향 렌즈에서는 I인데, 실제 답변에서는 이렇게 나왔다'다.
 *   - 애착유형·트라우마·감정조절능력 같은 심리 특성을 추론하지 않는다.
 *   - 랜덤이 없다. 같은 입력이면 언제나 같은 문장이다.
 */

/* ---------------------------------------------- Semantic Mapping (핵심 결정) */

interface SemanticMapping {
  mbtiAxis: MbtiAxisKey;
  signalAxis: TargetAxisKey;
}

/**
 * **MBTI 축 ↔ 관계 신호 축 의미적 매핑.**
 *
 * MBTI 선호 지표와 실제 관계 행동은 같은 개념이 아니다. 그래서 '연결 가능한 데이터가
 * 있다'는 이유로 연결하지 않고, **의미가 실제로 겹치는 한 쌍만** 남겼다.
 * 판단 근거와 기각 사유는 아래 표 그대로다(기획서 v1.24 P3-1 절과 동일한 표).
 *
 * ENERGY (E/I) ↔ 개인 시간(alone) — **사용**
 *   이유: 이 앱의 ENERGY 축 문구 자체가 이미 "혼자 있는 시간으로 에너지를 회복 /
 *         함께 활동하면서 얻는"이다. `alone` 신호는 문자 그대로 "혼자 있는 시간이
 *         얼마나 필요한가"를 1~5로 물어 저장한 값이다 — 두 축이 **같은 대상**
 *         (혼자 있는 시간)을 말한다.
 *   위험: I가 곧 '개인 시간을 많이 원함'은 아니다. 에너지 회복 방식과 관계에서
 *         기대하는 개인 시간의 양은 다른 개념이다.
 *   조건: '예측'이 아니라 '비교'로만 쓴다. 해석 문장에서 인과를 만들지 않는다.
 *
 * INFORMATION (S/N) ↔ 없음 — **사용 안 함 → UNKNOWN**
 *   구체·추상 정보 처리에 대응하는 관계 질문이 하나도 없다. 억지로 연락·계획 축에
 *   붙이면 근거 없는 대응이 된다.
 *
 * DECISION (T/F) ↔ 갈등 해결(conflict) — **사용 안 함 → UNKNOWN**
 *   표면적으로는 관련돼 보이지만 위험이 높다. 저장된 `conflict` 값은 '갈등 후
 *   이야기를 꺼내는 **시점**'(오늘 안에 / 잠깐 뒤 / 혼자 정리 후)이고, T/F는
 *   '판단할 때 먼저 보는 **기준**'이다. 서로 다른 것을 재는 값이라 연결하면
 *   'T라서 공감 못 함' 류의 stereotype이 된다. 데이터가 '갈등에서 원하는 대응'을
 *   실제로 저장하게 되면 그때 재검토한다.
 *
 * LIFESTYLE (J/P) ↔ 없음 — **사용 안 함 → UNKNOWN**
 *   계획·구조에 대응하는 관계 질문이 없다(연락은 빈도, 갈등은 시점, 애정은 표현량,
 *   개인 시간은 양). 'J/P = 데이트 계획'은 근거 없는 1:1 하드코딩이 된다.
 *
 * 4개 중 1개만 남는 것은 데이터의 정직한 결과다. 축 수를 채우려고 매핑을 늘리는 대신,
 * 비교할 수 없는 축은 `unmappedAxes`로 드러내고 **전체 그림 비교**
 * (`buildPatternBridge`)로 보완하는 쪽을 택했다.
 */
const SEMANTIC_MAPPINGS: readonly SemanticMapping[] = [
  { mbtiAxis: 'energy', signalAxis: 'alone' },
];

/* ------------------------------------------------------------- 문장 (출처 분리) */

/**
 * 두 출처의 문장이 섞이지 않게 접두 표현을 고정한다.
 *   MBTI  → '성향 렌즈에서는' / 'MBTI에서는'
 *   신호  → '네가 답한' / '실제 관계 답변에서는'
 */
function lensLineOf(mineLetter: string, theirsLetter: string, same: boolean): string {
  return same ? `둘 다 ${mineLetter}` : `${mineLetter} × ${theirsLetter}`;
}

/** 이미 계산된 `tone` 판정을 문장으로만 옮긴다 — 여기서 새로 판정하지 않는다. */
function signalLineOf(dimension: CompatibilityDimension): string {
  switch (dimension.tone) {
    case 'good':
      return `${dimension.label}에 대한 기대는 서로 비슷하게 답했어.`;
    case 'watch':
      return `${dimension.label}에서는 두 사람의 답이 서로 다르게 나왔어.`;
    case 'neutral':
      return `${dimension.label}은 아주 다르지도, 아주 비슷하지도 않게 나왔어.`;
    default:
      return `${dimension.label}은 한쪽 정보가 없어서 비교하지 않았어.`;
  }
}

/**
 * 해석 층. 네 조합 전부에 문장이 있어야 한다 — 판정과 어긋나는 문장을 쓰지 않기 위해서다
 * (v1.19 §4에서 축별 문구 하나를 모든 tone에 재사용해 모순이 났던 실수를 반복하지 않는다).
 */
function interpretationOf(
  lensSame: boolean,
  signalSimilar: boolean,
  signalAxisLabel: string,
): string {
  if (lensSame && signalSimilar) {
    return '성향 렌즈와 실제 관계 답변이 같은 방향을 가리켰어.';
  }
  if (lensSame && !signalSimilar) {
    return `같은 성향으로 분류돼도, ${signalAxisLabel}에서 서로 기대하는 정도까지 같지는 않았어.`;
  }
  if (!lensSame && signalSimilar) {
    return `성향 렌즈에서는 서로 다른 쪽으로 나뉬는데, ${signalAxisLabel}에서는 비슷한 걸 원한다고 답했어.`;
  }
  return '성향 렌즈에서 다르게 보였던 지점이, 실제 관계 답변에서도 다르게 나왔어.';
}

/**
 * `성향에서 비슷함 === 신호에서 비슷함` 이면 두 관점이 같은 방향이다.
 * 둘 다 '다름'을 가리켜도 같은 방향이므로 aligns다 — aligns를 '좋음'으로 읽지 않는다.
 */
function bridgeStateOf(mbtiSame: boolean, signalSimilar: boolean): MbtiBridgeState {
  return mbtiSame === signalSimilar ? 'aligns' : 'differs';
}

/* ------------------------------------------------------------------ 축 Bridge */

function buildAxisBridge(
  lens: MbtiLensReport,
  result: CompatibilityResult,
  mapping: SemanticMapping,
): MbtiAxisBridge | null {
  const mbtiAxis = lens.axes.find((axis) => axis.key === mapping.mbtiAxis);
  const definition = MBTI_AXES.find((axis) => axis.key === mapping.mbtiAxis);
  const dimension = result.dimensions.find((item) => item.key === mapping.signalAxis);
  // 매핑이 가리키는 축이 사라지면 잘못된 비교를 조용히 만들지 않고 아무 것도 만들지 않는다.
  if (!mbtiAxis || !definition || !dimension) return null;

  const base = {
    mbtiAxisKey: mbtiAxis.key,
    mbtiEyebrow: mbtiAxis.eyebrow,
    mbtiLabel: mbtiAxis.label,
    lensLine: lensLineOf(mbtiAxis.mineLetter, mbtiAxis.theirsLetter, mbtiAxis.same),
    lensSame: mbtiAxis.same,
    signalAxisKey: dimension.key,
    signalAxisLabel: dimension.label,
    signalLine: signalLineOf(dimension),
    signalMinePhrase: dimension.minePhrase,
    signalTheirsPhrase: dimension.theirsPhrase,
  };

  // 한쪽이 '모름'이면 비교 자체가 없었다. 없는 비교를 해석하지 않는다.
  if (dimension.alignment === null || dimension.tone === 'unknown') {
    return {
      ...base,
      state: 'unknown',
      unknownReason: 'no-signal',
      interpretation: `${dimension.label}에 대한 답이 아직 한쪽뿐이라, 이 축과는 비교하지 않았어.`,
    };
  }

  // neutral은 실패가 아니라 '뚜렷하지 않음'이다 — aligns/differs로 밀어 넣지 않는다.
  if (dimension.tone === 'neutral') {
    return {
      ...base,
      state: 'unknown',
      unknownReason: 'inconclusive',
      interpretation: `실제 관계 답변에서는 ${dimension.label}이 뚜렷하게 비슷하다고도, 다르다고도 나오지 않았어.`,
    };
  }

  const signalSimilar = dimension.tone === 'good';

  return {
    ...base,
    // 성향과 신호가 **같은 방향**을 가리키면 aligns. '잘 맞는다'는 뜻이 아니다.
    state: bridgeStateOf(mbtiAxis.same, signalSimilar),
    unknownReason: null,
    interpretation: interpretationOf(mbtiAxis.same, signalSimilar, dimension.label),
  };
}

/* -------------------------------------------------------------- 전체 그림 Bridge */

type Leaning = 'similar' | 'different' | 'mixed';

function mbtiLeaningOf(sameCount: number): Leaning {
  if (sameCount >= 3) return 'similar';
  if (sameCount <= 1) return 'different';
  return 'mixed';
}

function signalLeaningOf(similar: number, different: number): Leaning {
  if (similar > different) return 'similar';
  if (different > similar) return 'different';
  return 'mixed';
}

/**
 * 축 단위로 비교할 수 없는 세 축까지 포함해, **두 관점의 전체 방향**을 나란히 본다.
 *
 * ⚠️ 두 개수를 더하거나 평균 내지 않는다. 'MBTI 1개 + 신호 3개 = …' 같은 합산 지표를
 * 만들면 그 순간 MBTI가 궁합 점수에 들어간 것이 된다.
 */
function buildPatternBridge(
  lens: MbtiLensReport,
  result: CompatibilityResult,
): MbtiPatternBridge | null {
  // 관계 신호 자체를 비교할 수 없는 상태(E3)에서는 전체 그림을 말하지 않는다.
  if (result.score === null) return null;

  const signalSimilarCount = result.goodSignals.length;
  const signalDifferentCount = result.frictionSignals.length;

  const mbtiLeaning = mbtiLeaningOf(lens.sameCount);
  const signalLeaning = signalLeaningOf(signalSimilarCount, signalDifferentCount);

  const state: MbtiBridgeState =
    mbtiLeaning === 'mixed' || signalLeaning === 'mixed'
      ? 'unknown'
      : mbtiLeaning === signalLeaning
        ? 'aligns'
        : 'differs';

  const lensLine = `MBTI 4개 축 중 ${lens.sameCount}개가 같은 쪽이야.`;
  const signalLine = `비교한 관계 신호 ${result.comparedCount}개 중 ${signalSimilarCount}개는 비슷하게, ${signalDifferentCount}개는 다르게 답했어.`;

  const interpretation = ((): string => {
    if (state === 'differs' && mbtiLeaning === 'similar') {
      return '성향 렌즈에서는 비슷한 축이 더 많은데, 네가 답한 관계 신호에서는 다른 쪽이 더 많았어.';
    }
    if (state === 'differs') {
      return '성향 렌즈에서는 다른 축이 더 많은데, 네가 답한 관계 신호에서는 비슷한 쪽이 더 많았어.';
    }
    if (state === 'aligns' && mbtiLeaning === 'similar') {
      return '성향 렌즈와 실제 관계 답변이 같은 방향을 가리켰어 — 둘 다 비슷한 쪽이 더 많아.';
    }
    if (state === 'aligns') {
      return '성향 렌즈와 실제 관계 답변이 같은 방향을 가리켰어 — 둘 다 다른 쪽이 더 많아.';
    }
    return '두 관점 중 한쪽이 뚜렷한 방향을 보여주지 않아서, 같은 방향인지는 아직 말하기 어려워.';
  })();

  return {
    mbtiSameCount: lens.sameCount,
    mbtiDifferentCount: lens.differentCount,
    signalSimilarCount,
    signalDifferentCount,
    signalComparedCount: result.comparedCount,
    state,
    lensLine,
    signalLine,
    interpretation,
  };
}

/* ------------------------------------------------------------------- Surprise */

/**
 * 가장 강한 관찰 하나. **랜덤이 아니라 고정된 우선순위**다.
 *
 *   1. 축 비교: MBTI는 같은데 실제 답은 다름   ← 가장 강한 Surprise
 *   2. 축 비교: MBTI는 다른데 실제 답은 비슷함
 *   3. 전체 그림이 서로 다른 방향
 *   4. 축 비교가 같은 방향
 *   5. 전체 그림이 같은 방향
 *   6. 비교 가능한 것이 없으면 null — 없는 Surprise를 만들지 않는다
 */
function selectSurprise(
  axisBridges: readonly MbtiAxisBridge[],
  pattern: MbtiPatternBridge | null,
): MbtiBridgeSurprise | null {
  const fromAxis = (bridge: MbtiAxisBridge, hook: string): MbtiBridgeSurprise => ({
    state: bridge.state,
    source: 'axis',
    hook,
    evidenceLabel: `${bridge.mbtiEyebrow} · ${bridge.signalAxisLabel}`,
    evidenceLensLine: bridge.lensLine,
    evidenceSignalLine: `나: ${bridge.signalMinePhrase} · 상대: ${bridge.signalTheirsPhrase}`,
  });

  const fromPattern = (bridge: MbtiPatternBridge, hook: string): MbtiBridgeSurprise => ({
    state: bridge.state,
    source: 'pattern',
    hook,
    evidenceLabel: '전체 그림',
    evidenceLensLine: bridge.lensLine,
    evidenceSignalLine: bridge.signalLine,
  });

  const differing = axisBridges.filter((bridge) => bridge.state === 'differs');

  const sameLensDiffers = differing.find((bridge) => bridge.lensSame);
  if (sameLensDiffers) {
    return fromAxis(
      sameLensDiffers,
      `성향 렌즈에서는 ${sameLensDiffers.lensLine}로 묶이는데, ${sameLensDiffers.signalAxisLabel}에 대한 기대는 오히려 다르게 답했네.`,
    );
  }

  const diffLensDiffers = differing.find((bridge) => !bridge.lensSame);
  if (diffLensDiffers) {
    return fromAxis(
      diffLensDiffers,
      `성향 렌즈에서는 서로 다른 쪽으로 나뉬는데, ${diffLensDiffers.signalAxisLabel}에서는 비슷한 걸 원한다고 답했네.`,
    );
  }

  if (pattern?.state === 'differs') {
    return fromPattern(
      pattern,
      pattern.mbtiSameCount >= 3
        ? 'MBTI에서는 비슷한 축이 더 많은데, 실제로 답한 신호에서는 다른 쪽이 더 많네.'
        : 'MBTI에서는 다른 축이 더 많은데, 실제로 답한 신호에서는 비슷한 쪽이 더 많네.',
    );
  }

  const aligning = axisBridges.find((bridge) => bridge.state === 'aligns');
  if (aligning) {
    return fromAxis(
      aligning,
      `${aligning.signalAxisLabel}은 성향 렌즈와 실제 답이 같은 쪽을 가리켰어. 같은 방향이라고 같은 이유인지는 아직 모르겠지만.`,
    );
  }

  if (pattern?.state === 'aligns') {
    return fromPattern(
      pattern,
      '두 관점이 같은 방향을 가리켰네. 그래도 같은 방향이라고 같은 뜻인지는 더 봐야겠어.',
    );
  }

  return null;
}

/* ---------------------------------------------------------------------- Entry */

/**
 * @param lens   두 사람의 MBTI가 모두 있을 때만 값이 있다(`buildMbtiLens`).
 * @param result 이미 계산이 끝난 궁합 결과. **읽기만** 한다.
 * @returns MBTI가 둘 다 있지 않으면 null — 비교할 렌즈 자체가 없다.
 */
export function buildMbtiBridge(
  lens: MbtiLensReport | null,
  result: CompatibilityResult,
): MbtiBridgeReport | null {
  if (!lens) return null;

  const axisBridges = SEMANTIC_MAPPINGS.map((mapping) =>
    buildAxisBridge(lens, result, mapping),
  ).filter((bridge): bridge is MbtiAxisBridge => bridge !== null);

  const mappedAxes = new Set(SEMANTIC_MAPPINGS.map((mapping) => mapping.mbtiAxis));
  const unmappedAxes: MbtiUnmappedAxis[] = lens.axes
    .filter((axis) => !mappedAxes.has(axis.key))
    .map((axis) => ({ key: axis.key, eyebrow: axis.eyebrow, label: axis.label }));

  const pattern = buildPatternBridge(lens, result);

  /**
   * 관계 답변이 비교 가능한 수준인지. 미달이면 Bridge를 억지로 만들지 않고
   * 화면이 정직한 제한 문구를 대신 보여준다 — MBTI Lens 본문은 그대로 유지된다.
   */
  const available =
    result.score !== null &&
    (axisBridges.some((bridge) => bridge.state !== 'unknown') || pattern !== null);

  return {
    available,
    axisBridges,
    unmappedAxes,
    pattern,
    surprise: available ? selectSurprise(axisBridges, pattern) : null,
  };
}
