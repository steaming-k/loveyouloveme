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
    <div className="flex flex-col gap-1.5 rounded-chip border border-dashed border-line-strong bg-canvas-warm px-3.5 py-3">
      <p className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
        PAST OBSERVATION
      </p>
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

  return (
    <section className="flex flex-col gap-2.5 rounded-card border border-line bg-surface p-4">
      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
          PAST OBSERVATION
        </p>
        <h2 className="text-body font-semibold tracking-[-0.2px]">
          {HISTORY_COPY.repeatedTitle}
        </h2>
        <p className="text-[12.5px] keep-all text-ink-sub">{HISTORY_COPY.repeatedCaption}</p>
      </div>

      <ul className="flex flex-col gap-1.5">
        {signals.map((signal) => (
          <li
            key={signal.axis}
            className="flex items-center justify-between gap-3 rounded-chip bg-sunken px-3 py-2.5"
          >
            <span className="text-caption font-medium">{signal.label}</span>
            <span className="flex-none text-[11.5px] tnum text-ink-sub">
              관찰 {signal.occurrences}회
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
