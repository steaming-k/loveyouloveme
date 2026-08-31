import { MBTI_AXES } from '@/data/mbti';
import type {
  ConversationQuestion,
  MbtiAxisComparison,
  MbtiLensReport,
  MbtiType,
} from '@/types';

/**
 * MBTI Lens (Supporting) — 점수가 아니라 '대화 포인트'를 만든다.
 *
 * ⚠️ 이전 구현(v1.1 초기)은 `같은 글자 수 / 4`를 similarity로 만들어 동기화율 평균에 넣었다.
 * E/I·S/N·T/F·J/P가 많이 같다고 두 사람이 더 좋은 관계를 형성한다는 의미가 아니므로 그 방식은
 * 제거했다. 이제 4개 선호 축을 **독립적으로** 비교하고, 각 축을 이야기해볼 주제로만 제시한다.
 *
 * 같은 글자 = 좋음 / 다른 글자 = 나쁨으로 표현하지 않는다.
 * ('비슷한 성향' / '다르게 나타날 수 있는 성향'만 사용)
 */
export function buildMbtiLens(
  mine: MbtiType | null,
  theirs: MbtiType | null,
): MbtiLensReport | null {
  if (!mine || !theirs) return null;

  const axes: MbtiAxisComparison[] = MBTI_AXES.map((def) => {
    const mineLetter = mine[def.index]!;
    const theirsLetter = theirs[def.index]!;
    const same = mineLetter === theirsLetter;

    return {
      key: def.key,
      eyebrow: def.eyebrow,
      label: def.label,
      mineLetter,
      theirsLetter,
      same,
      note: same ? (def.same[mineLetter] ?? def.different) : def.different,
    };
  });

  const sameCount = axes.filter((axis) => axis.same).length;

  return {
    mine,
    theirs,
    axes,
    sameCount,
    differentCount: axes.length - sameCount,
  };
}

/**
 * 선호가 다른 축에서 만드는 보조 대화 질문.
 * 관계 신호 기반 질문(S25 본문)을 대체하지 않고 뒤에 덧붙는 Optional 항목이다.
 */
export function buildMbtiQuestions(report: MbtiLensReport | null): ConversationQuestion[] {
  if (!report) return [];

  return report.axes
    .filter((axis) => !axis.same)
    .map((axis) => {
      const def = MBTI_AXES.find((item) => item.key === axis.key)!;
      return {
        id: `mbti_${axis.key}` as const,
        tag: `${axis.label} · MBTI 렌즈에서 나온 질문`,
        text: def.question,
        fromFriction: false,
        fromMbti: true,
      };
    });
}
