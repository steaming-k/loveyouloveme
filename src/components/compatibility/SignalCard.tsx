import type { ReactNode } from 'react';

import { ComparePair } from '@/components/common/primitives';
import { cn } from '@/lib/cn';
import { EVIDENCE_TOGGLE_LABEL } from '@/lib/premiumSoWhat';
import type { CompatibilityDimension } from '@/types';

/**
 * Good Signal (S23) / Friction Signal (S24)
 *
 * ══ v1.46.4 §3 — 순서를 뒤집었다 ═══════════════════════════════════════════
 *
 * v1.46.3까지 이 카드의 순서는 이랬다:
 *
 * ```
 * 축 이름 → [나: 연락 중요도 5/5 · 상대: 뜸한 편] → 일어날 수 있는 상황 → 근거(접힘)
 * ```
 *
 * 두 번째 줄은 **사용자가 방금 입력한 값 두 개**다. 결과 화면에서 가장 먼저 읽히는
 * 자리에 자기가 쓴 답이 그대로 있으니, UT-1의 '이미 알고 있는 내용이 너무 많다'가
 * 정확히 여기였다.
 *
 * 지금 순서:
 *
 * ```
 * 축 이름 → 그래서 이게 무슨 의미야(=scene) → 근거 펼치기 [나/상대 값 + 판정 근거]
 * ```
 *
 * ⚠️ **값을 지운 게 아니다.** `ComparePair`는 근거 토글 안 첫 줄로 내려갔다 —
 * 사용자가 입력한 것은 결론이 아니라 근거라는 원칙 그대로다(§8).
 *
 * Friction은 'RED FLAG' / 'WARNING' 같은 표현을 쓰지 않는다.
 * 안 맞는다는 판정이 아니라 '차이가 보이는 지점'으로만 다룬다.
 *
 * v1.23 §9 — `density` 두 단계.
 *   `primary` : 가장 중요한 신호 1개. 카드 + 상황 + 근거까지 전부
 *   `compact` : '더 보기'로 펼쳐지는 나머지. 카드 테두리를 없애고 divider 행으로,
 *                typography도 한 단계 낮춘다 — 같은 규격 카드를 4개 쌓으면 무엇이 중요한지
 *                사라진다. **정보를 빼는 것이 아니라 위계를 만드는 것이다**(상황·근거는 그대로).
 */
export function SignalCard({
  dimension,
  variant,
  footer,
  density = 'primary',
  userCondition,
}: {
  dimension: CompatibilityDimension;
  variant: 'good' | 'friction';
  density?: 'primary' | 'compact';
  /**
   * v1.7 — AI 설명 블록을 카드 안 마지막에 붙이기 위한 슬롯.
   * `<li>`를 이 컴포넌트가 만들기 때문에 바깥에서 형제로 끼우면 마크업이 깨진다.
   * AI 설명은 신호·근거 **뒤**에 오므로 위치도 여기가 맞다(§12).
   */
  footer?: ReactNode;
  /**
   * 260915 UT P1-1 §21 — 사용자가 **더 자세히 알려주기**에서 좁혀준 조건.
   *
   * 심화 입력이 결과를 실제로 더 구체적으로 만드는 **결정론 경로**다. AI 설명은
   * 있을 수도 없을 수도 있으므로(demo · 실패 · Quality Gate), 그것만으로는
   * '답한 만큼 결과가 달라진다'를 보장할 수 없다.
   *
   * ⚠️ 새 판정이 아니다. 사용자가 고른 보기를 그 축 카드에 되돌려 보여줄 뿐이고,
   * 점수·차이 계산에는 들어가지 않는다.
   */
  userCondition?: string | null;
}) {
  const gap =
    dimension.mineValue !== null && dimension.theirsValue !== null
      ? Math.abs(dimension.mineValue - dimension.theirsValue)
      : null;

  const compact = density === 'compact';

  return (
    <li
      className={cn(
        'flex flex-col',
        compact
          ? 'gap-2.5 border-t border-line-soft px-1 pt-3.5'
          : 'gap-3 rounded-card border border-line bg-surface p-4',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'flex-none rounded-full',
              compact ? 'h-[5px] w-[5px]' : 'h-[7px] w-[7px]',
              variant === 'good' ? 'bg-brand' : 'bg-friction',
            )}
            aria-hidden
          />
          <h3
            className={cn(
              'font-semibold tracking-[-0.2px]',
              compact ? 'text-caption text-ink-sub' : 'text-body',
            )}
          >
            {dimension.label}
          </h3>
        </div>

        {variant === 'friction' && gap !== null ? (
          <span className="flex-none rounded-[6px] bg-friction-tint px-2 py-1 text-[10.5px] font-semibold text-friction-text">
            차이 {gap}
          </span>
        ) : null}
      </div>

      {/* ① SO WHAT — 이 카드에서 가장 먼저 읽히는 줄 */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[10.5px] font-semibold tracking-[0.04em] text-ink-muted">
          {variant === 'good' ? '이런 점이 편할 수 있어' : '일어날 수 있는 상황'}
        </p>
        <p
          className={cn(
            'keep-all leading-relaxed',
            compact
              ? 'text-caption text-ink-sub'
              : variant === 'good'
                ? 'rounded-[10px] bg-mint-tint px-3 py-2.5 text-caption text-mint-ink'
                : 'text-[13.5px] text-ink',
          )}
        >
          {dimension.scene}
        </p>
        {/*
          260915 UT P1-1 §21 — 답한 축에만 붙는다. 답하지 않았으면 이 줄은 없다.
          '언제 그런지'는 우리가 만든 해석이 아니라 사용자가 고른 조건이라 그렇게 말한다.
        */}
        {userCondition ? (
          <p className="rounded-[10px] bg-sunken px-3 py-2 text-[12px] keep-all leading-relaxed text-ink-sub">
            <span className="font-semibold text-ink">네가 알려준 조건</span> · {userCondition}
          </p>
        ) : null}
      </div>

      {/*
        ② EVIDENCE — 기본 닫힘. **내가 입력한 값이 여기 첫 줄**이다(§8).
        라벨도 '이 신호를 본 근거'에서 `왜 이렇게 봤어?`로 맞춘다 — 유료 리포트의
        근거 토글과 같은 말을 쓰면 사용자가 두 화면에서 같은 동작을 기대할 수 있다.
      */}
      <details className={cn(compact ? 'pt-0.5' : 'border-t border-line-soft pt-2.5')}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center text-[11.5px] font-semibold text-brand-pressed">
          {EVIDENCE_TOGGLE_LABEL}
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <ComparePair mine={dimension.minePhrase} theirs={dimension.theirsPhrase} />
          <p className="text-[12.5px] keep-all leading-relaxed text-[#555]">
            {dimension.evidence}
          </p>
        </div>
      </details>

      {footer}
    </li>
  );
}
