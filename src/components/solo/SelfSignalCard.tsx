import type { SelfSignal, SelfSignalPair } from '@/types';

/**
 * Solo 관찰 부품 (v1.29 · P4 §25 · §50)
 *
 * ⚠️ **`ComparePair`를 재사용하지 않는다.** 그 컴포넌트는 `나 ↔ 상대` 두 칸을 전제로
 * 만들어졌고, 상대가 없는 화면에 억지로 넣으면 한 칸이 비어 보인다. v1.23이
 * Remaining Risk로 남긴 `SignalCard = ComparePair 2단 구조`를 여기서 되풀이하지 않는다.
 *
 * 시각 구조가 리포트의 성격을 그대로 말한다(§50):
 *
 *   PAIR REPORT    SUBJECT A  ↔  SUBJECT B
 *   SOLO REPORT    SUBJECT A
 *                    ↓
 *                  SIGNAL 01
 *                  SIGNAL 02
 *
 * ⚠️ Visual Direction — 하트·커플 실루엣·pink gradient·match animation을 쓰지 않는다(§49).
 * 여기 쓰는 것은 divider · 좌측 rule · 작은 metadata뿐이다. Dating app이 아니라
 * **러비가 한 인간을 단독 관찰한 보고서**로 읽혀야 한다.
 */

/** `SIGNAL 01` 표식 — 숫자는 순서일 뿐이고 점수가 아니다(§29) */
function SignalIndex({ index }: { index: number }) {
  return (
    <span className="text-[10px] font-semibold tracking-[0.1em] text-ink-faint tnum">
      SIGNAL {String(index).padStart(2, '0')}
    </span>
  );
}

export function SelfSignalCard({ signal, index }: { signal: SelfSignal; index: number }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-line-soft pt-3.5">
      <div className="flex items-baseline gap-2">
        <SignalIndex index={index} />
        <span className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
          {signal.label}
        </span>
      </div>

      {/* 사용자가 고른 값 그대로 — 해석을 섞지 않는다 */}
      <p className="text-[14px] font-medium keep-all leading-relaxed tracking-[-0.2px]">
        {signal.valueText}
      </p>

      {/* 그 답이 관계를 시작할 때 어떤 모양으로 보이는지. 성격 규정이 아니다 */}
      <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">{signal.approachText}</p>
    </div>
  );
}

/**
 * 두 신호가 한 지점으로 모이는 모양. **장식이므로 `aria-hidden`이고**, 같은 정보가
 * 위 라벨과 아래 문장에 텍스트로 이미 있다.
 */
function PairConnector() {
  return (
    <span aria-hidden className="relative flex w-3 flex-none items-center self-stretch">
      <span className="absolute inset-y-[7px] left-0 w-full rounded-r-[4px] border-y border-r border-line-strong" />
      <span className="absolute right-[-6px] top-1/2 h-px w-[6px] bg-line-strong" />
    </span>
  );
}

/**
 * **내 답변 안에서 함께 나타난 두 신호** (§23-03)
 *
 * Premium의 `DeepConnectionCard`와 같은 규칙을 따른다 — 근거를 숨기지 않고,
 * **말할 수 없는 것(`limitation`)을 항상 함께 보여준다.** 다만 이어지는 것이
 * '나와 상대'가 아니라 '내 답변 두 개'라서 라벨이 `함께 나타남`이다.
 */
export function SelfPairCard({ pair }: { pair: SelfSignalPair }) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
      <div className="flex items-start gap-2">
        <ul className="flex min-w-0 flex-col gap-1">
          {pair.labels.map((label) => (
            <li key={label} className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
              {label}
            </li>
          ))}
        </ul>
        <PairConnector />
        <span className="ml-1.5 self-center text-[10px] font-semibold tracking-[0.1em] text-mint-ink">
          함께 나타남
        </span>
      </div>

      <p className="text-[13.5px] keep-all leading-relaxed">{pair.observation}</p>

      {/* 근거는 사용자가 고른 값 그대로다 — 새로 만든 문장이 아니다 */}
      <ul className="flex flex-col gap-1 rounded-[10px] bg-sunken px-3.5 py-3">
        {pair.evidence.map((text) => (
          <li key={text} className="text-[12px] keep-all leading-relaxed text-ink">
            {text}
          </li>
        ))}
      </ul>

      {/* 이 관찰이 말할 수 없는 것 — 항상 있다(인과가 아니라 연관이라는 경계) */}
      <p className="border-l-2 border-line-strong pl-3 text-[11.5px] keep-all leading-relaxed text-ink-muted">
        {pair.limitation}
      </p>
    </div>
  );
}
