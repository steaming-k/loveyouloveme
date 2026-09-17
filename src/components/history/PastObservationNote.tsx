import { HISTORY_COPY } from '@/data/copy';
import type { RepeatedRelationshipSignal } from '@/types';

/**
 * Past Observation — Supporting Evidence (§22/§24)
 *
 * ⚠️ 이 블록은 현재 Mirror·Compatibility **판정을 바꾸지 않는다.** 현재 판정은 현재 데이터로만
 * 하고, 여기서는 '과거에도 비슷한 신호가 있었다'는 사실만 덧붙인다.
 *
 * 정보 위계(§25): Actual Relationship Signal → Evidence/Situation → **Past Observation** → MBTI Lens.
 * 그래서 실제 신호 카드보다 시각적으로 약한 중립 톤만 쓴다.
 */
export function PastObservationNote({ text }: { text: string }) {
  return (
    /*
      v1.48 — 파선 카드에서 **근거 인용문**으로. 이 블록은 판정이 아니라 '예전에도
      비슷한 신호가 있었다'는 출처이므로, Evidence Surface의 좌측 rule을 쓴다.
    */
    <div className="surf-evidence flex flex-col gap-1.5">
      <p className="evidence-source">PAST OBSERVATION</p>
      <p className="text-[12.5px] keep-all leading-relaxed text-[#555]">{text}</p>
    </div>
  );
}

/**
 * 반복 신호 알림 (§21) — '이 신호… 처음 보는 게 아닌데.'
 * 금지 표현: '너는 항상 이래' / '반복되는 문제야' / '너의 연애 패턴은 이거야'
 */
export function RepeatedSignalNotice({
  signals,
}: {
  signals: readonly RepeatedRelationshipSignal[];
}) {
  if (signals.length === 0) return null;

  /*
    v1.48 — 카드 안의 회색 알약 목록에서 **관찰 대장(ledger)**으로.

    예전 구조는 `card > chip row × N`이었다. 반복 신호는 '몇 번 봤는지'를 세는
    기록이므로, 담는 면이 아니라 **행과 행을 나누는 선**이 맞는 형태다 — 장부처럼
    라벨과 횟수가 좌우로 갈리고 사이를 rule이 잇는다.

    ⚠️ 라벨·횟수·문구·판정은 그대로다. 표면만 바뀐다.
  */
  return (
    <section className="flex flex-col gap-2.5 px-1">
      <div className="flex flex-col gap-1">
        <p className="evidence-source">PAST OBSERVATION</p>
        <h2 className="text-body font-semibold tracking-[-0.2px]">
          {HISTORY_COPY.repeatedTitle}
        </h2>
        <p className="text-[12.5px] keep-all text-ink-sub">{HISTORY_COPY.repeatedCaption}</p>
      </div>

      <ul className="flex flex-col">
        {signals.map((signal) => (
          <li
            key={signal.axis}
            className="flex items-baseline justify-between gap-3 border-t border-[color:var(--color-rule-hair)] py-2.5"
          >
            <span className="text-caption font-medium">{signal.label}</span>
            {/* 점선 leader — 라벨과 숫자를 잇는다. 장부에서 금액을 잇는 그 선이다 */}
            <span
              aria-hidden
              className="min-w-4 flex-1 translate-y-[-3px] border-b border-dotted border-rule-mid"
            />
            <span className="flex-none text-[11.5px] tnum text-ink-sub">
              관찰 {signal.occurrences}회
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
