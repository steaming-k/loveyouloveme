import { MBTI_AXES, MBTI_PATTERNS } from '@/data/mbti';
import { MBTI_PATTERN_OBSERVATION } from '@/data/lovyNotes';
import type {
  MbtiAxisComparison,
  MbtiLensReport,
  MbtiPatternCheck,
  MbtiPatternKey,
  MbtiPatternReport,
} from '@/types';

/**
 * MBTI 조합 패턴 (v1.25 · P3-2)
 *
 * 무료 MBTI Lens가 **반드시** 세 가지를 주도록 만드는 모듈이다:
 *   1. 이 조합에서 눈여겨볼 성향 패턴
 *   2. 러비의 심리/철학적 관찰 1개
 *   3. 실제 관계에서 확인해볼 질문 1개
 *
 * 왜 이 모듈이 필요했나 — P3-1의 무료 화면은 **구조는 좋아졌지만 정보가 적었다**
 * (실사용 피드백). 4축 표는 글자 위치만 보여줬고, 러비의 관찰은 그 표를 한 줄로
 * 옮겨 적은 것이라 새로 얻는 게 없었다.
 *
 * ⚠️ 지키는 경계
 *   - **축 설명을 늘려서 채우지 않는다.** MBTI 교육 페이지가 되면 실패다.
 *   - **관계 답변을 여기 끌어오지 않는다.** 이 모듈은 `CompatibilityResult`를
 *     import조차 하지 않는다 — 관계 신호와의 대조는 `mbtiBridge.ts`의 일이다.
 *   - **유형쌍 사전을 만들지 않는다.** 256개 조합을 4축 같음/다름이 만드는
 *     5개 구조로만 읽는다(`MBTI_PATTERNS`).
 *   - 새 점수 0 · 랜덤 0. 같은 두 유형이면 언제나 같은 결과다.
 */

/**
 * 축 두 묶음 — MBTI 자체의 표준 구분을 그대로 쓴다.
 *   INNER  정보를 받아들이고(S/N) 판단하는(T/F) 과정
 *   OUTER  에너지를 회복하고(E/I) 생활을 조직하는(J/P) 리듬
 */
const INNER_AXES = ['information', 'decision'] as const;
const OUTER_AXES = ['energy', 'lifestyle'] as const;

function allSameIn(
  axes: readonly MbtiAxisComparison[],
  keys: readonly string[],
): boolean {
  const group = axes.filter((axis) => keys.includes(axis.key));
  // 축이 하나라도 비면 '전부 같다'고 말하지 않는다 — 없는 근거로 판정하지 않는다.
  return group.length === keys.length && group.every((axis) => axis.same);
}

/**
 * 5개 버킷은 **상호 배타적이고 전체를 덮는다.**
 *   4개 같음                        → all-same
 *   0개 같음                        → all-different
 *   INNER 둘 다 같고 OUTER는 아님    → inner-same
 *   OUTER 둘 다 같고 INNER는 아님    → outer-same
 *   그 외                           → mixed
 * (INNER·OUTER가 둘 다 같으면 4개 같음이므로 첫 분기에서 이미 걸린다)
 */
function patternKeyOf(report: MbtiLensReport): MbtiPatternKey {
  if (report.sameCount === 4) return 'all-same';
  if (report.sameCount === 0) return 'all-different';

  const innerSame = allSameIn(report.axes, INNER_AXES);
  const outerSame = allSameIn(report.axes, OUTER_AXES);

  if (innerSame && !outerSame) return 'inner-same';
  if (outerSame && !innerSame) return 'outer-same';
  return 'mixed';
}

/**
 * 확인해볼 질문 하나.
 *
 * 새 질문 데이터를 만들지 않고 이미 있는 `MBTI_AXES[].question`을 쓴다 — 같은 사실을
 * 두 곳에서 다르게 관리하지 않기 위해서다(그 질문들은 v1.25 Audit에서 **축과 같은
 * 층위**에 머물도록 손봤다: 특정 연애 행동을 지목하지 않는다).
 *
 * 고르는 규칙(고정):
 *   - 갈린 축이 있으면 **축 정의 순서상 첫 번째 갈린 축**
 *   - 하나도 갈리지 않았으면(네 축 모두 같음) 첫 번째 축
 *
 * 두 경우의 `why`가 다르다 — 전자는 '정말 다른지', 후자는 '같은 글자가 같은 뜻인지'를
 * 확인하는 질문이다. 어느 쪽도 답을 예측해서 말하지 않는다.
 */
function buildCheck(report: MbtiLensReport): MbtiPatternCheck {
  const ordered = MBTI_AXES.map((definition) =>
    report.axes.find((axis) => axis.key === definition.key),
  ).filter((axis): axis is MbtiAxisComparison => axis !== undefined);

  const target = ordered.find((axis) => !axis.same) ?? ordered[0]!;
  const definition = MBTI_AXES.find((item) => item.key === target.key)!;

  return {
    axisKey: target.key,
    axisEyebrow: target.eyebrow,
    axisLabel: target.label,
    same: target.same,
    question: definition.question,
    why: target.same
      ? '성향 렌즈에서는 둘이 같은 쪽으로 나온 축이야. 같은 글자가 같은 뜻인지는 물어봐야 알 수 있어.'
      : '성향 렌즈에서 둘이 갈린 축이야. 실제로도 그런지는 물어봐야 알 수 있어.',
  };
}

/**
 * @param report 두 사람의 MBTI가 모두 있을 때만 값이 있다(`buildMbtiLens`).
 * @returns MBTI가 둘 다 있지 않으면 null — 비교할 조합 자체가 없다.
 */
export function buildMbtiPattern(report: MbtiLensReport | null): MbtiPatternReport | null {
  if (!report) return null;

  const key = patternKeyOf(report);
  const definition = MBTI_PATTERNS[key];

  return {
    key,
    label: definition.label,
    body: definition.body,
    watchFor: definition.watchFor,
    observation: MBTI_PATTERN_OBSERVATION[key],
    check: buildCheck(report),
  };
}
