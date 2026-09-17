import { SignalTrack, SignalTrackLegend } from '@/components/common/fieldNotes';
import { cn } from '@/lib/cn';
import type { CompatibilityDimension } from '@/types';

/**
 * 신호 구조 — 동기화율 바로 아래에서 '이 숫자가 무엇으로 만들어졌는지'를 그린다 (v1.48)
 *
 * ══ 왜 만들었나 ═════════════════════════════════════════════════════════════
 *
 * Hero가 `큰 숫자 하나 + 설명 한 줄`이었다. 숫자는 요약인데 그 요약을 **무엇으로부터**
 * 만들었는지는 한참 아래 신호 카드까지 스크롤해야 나왔다. 그래서 첫 화면이 말하는 것이
 * '55점짜리 관계'였고, 이 제품이 말하려는 '네 개의 축이 이만큼씩 떨어져 있다'가 아니었다.
 *
 * ```
 *  55  │ 관계의 결과를 예측하는 점수는 아니야
 *  ────────────────────────────────────────
 *  연락       ●───●        차이 1
 *  갈등 해결  ●──────●     차이 3
 *  개인 시간  ●            일치
 *  애정 표현  ●─●          차이 1
 * ```
 *
 * ══ ⚠️ 새 계산이 아니다 ══════════════════════════════════════════════════════
 *
 * 입력은 `result.dimensions` **그대로**다. 각 축이 이미 가지고 있던 `mineValue` /
 * `theirsValue`(1~5, 모름이면 null)를 트랙 위 제자리에 찍을 뿐이고, 여기서 점수·차이·
 * 판정을 새로 만들지 않는다. `차이 N`은 `SignalCard`가 이미 같은 방식(`|mine - theirs|`)
 * 으로 보여주던 값이다.
 *
 * - **radar chart를 그리지 않는다.** 4축 다각형은 없는 정밀도를 만든다.
 * - **성공확률처럼 보이지 않게 한다.** 채워지는 막대가 아니라 떨어져 있는 두 점이다.
 * - **비교 못 한 축을 지우지 않는다.** 모름은 점선으로 남겨 '아직 비교 전'이라고 말한다 —
 *   빼버리면 사용자는 자기가 답하지 않은 축이 있다는 사실 자체를 알 수 없다.
 */
export function SignalStructure({
  dimensions,
  className,
}: {
  dimensions: readonly CompatibilityDimension[];
  className?: string;
}) {
  if (dimensions.length === 0) return null;

  /** 비교 가능한 축이 하나도 없으면 트랙만 늘어선 빈 그림이 된다 — 그럴 땐 그리지 않는다 */
  const comparable = dimensions.filter((d) => d.mineValue !== null && d.theirsValue !== null);
  if (comparable.length === 0) return null;

  return (
    <section className={cn('flex flex-col px-1', className)} aria-label="항목별 신호 구조">
      <div className="field-rule" />

      <ul className="flex flex-col divide-y divide-[color:var(--color-rule-hair)]">
        {dimensions.map((dimension) => (
          <li key={dimension.key}>
            <SignalTrack
              label={dimension.label}
              mine={dimension.mineValue}
              theirs={dimension.theirsValue}
              /*
                ⚠️ 판정을 새로 하지 않는다 — `dimension.tone`은 이미 계산된 값이고
                여기서는 그 값을 색으로만 옮긴다. `watch`만 friction 색을 쓴다.
              */
              tone={dimension.tone === 'watch' ? 'friction' : 'good'}
              unknownLabel="비교 전"
            />
          </li>
        ))}
      </ul>

      <div className="field-rule" />

      <SignalTrackLegend className="pt-2.5" />

      {/*
        스크린리더에는 점의 위치가 아니라 **값 그대로** 읽힌다. 시각적 트랙은 비교를
        빠르게 훑기 위한 것이고, 숫자 자체를 못 읽게 만들면 안 된다.
      */}
      <p className="sr-only">
        {dimensions
          .map((d) =>
            d.mineValue !== null && d.theirsValue !== null
              ? `${d.label}: 나 ${d.mineValue}점, 상대 ${d.theirsValue}점.`
              : `${d.label}: 아직 비교하지 못했어.`,
          )
          .join(' ')}
      </p>
    </section>
  );
}
