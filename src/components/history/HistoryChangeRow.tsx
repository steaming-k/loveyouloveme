import type { ReactNode } from 'react';

import { ScaleHearts } from '@/components/common/ScaleHearts';
import { TRACK, trackTop } from '@/components/common/fieldNotes';
import { HISTORY_COPY, HISTORY_STATE_LABEL } from '@/data/copy';
import { cn } from '@/lib/cn';
import { valueToPercent } from '@/lib/logic/mirror';
import type { HistoryAxisChange, HistoryChangeState } from '@/types';

/**
 * PAST vs NOW 한 행 (F2 / History Detail)
 *
 * 규칙:
 * - 과거/현재를 **색으로만 구분하지 않는다** — PAST / NOW 라벨을 항상 함께 쓴다(§35)
 * - 직접 1~5로 수집한 축만 트랙 위 점으로 비교한다. Relationship Evidence는 텍스트만(§14/§36)
 * - STABLE/SHIFT는 좋음·나쁨이 아니다. 색으로 우열을 만들지 않는다
 */

/**
 * PAST/NOW 트랙의 rail과 점. **둘 다 홀수**라 공통 중심(`TRACK.center` 7.5)에서
 * 정수 top이 나온다 — 짝수를 쓰면 그 요소만 반픽셀에 놓여 선에서 빗나가 보인다.
 */
const HISTORY_RAIL = 3;
const HISTORY_DOT = 9;

const STATE_CLASS: Record<HistoryChangeState, string> = {
  STABLE: 'bg-mint-tint text-mint-text',
  SHIFT: 'bg-brand-tint text-brand-pressed',
  NEW: 'bg-chip text-ink',
  INSUFFICIENT: 'bg-sunken text-ink-muted',
};

/**
 * ⚠️ v1.48.2 — 선과 점이 `fieldNotes`의 **공통 중심축**(`TRACK` · `trackTop`)을 쓴다.
 *
 * 예전에는 3px짜리 rail 자체가 컨테이너였고 점은 `top-1/2` + `-translate-y-1/2`로
 * 얹혀 있었다. 홀수 높이 부모에 `50%`를 곱하는 조합이라 중심이 반픽셀에 걸렸고,
 * 그 위상은 부모가 놓인 소수 좌표에 따라 매번 달라졌다. 지금은 rail도 점도
 * 같은 중심에서 **정수 top**을 받는다 — `SignalTrack`과 같은 규칙이다.
 *
 * ⚠️ `valueToPercent`(가로 위치)는 그대로다. 이 수정은 **세로 정렬만** 바꾼다.
 */
function ScaleTrack({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[34px] flex-none text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
        {label}
      </span>
      <div className="relative min-w-0 flex-1" style={{ height: TRACK.height }}>
        <span
          className="absolute inset-x-0 rounded-sm bg-track"
          style={{ top: trackTop(HISTORY_RAIL), height: HISTORY_RAIL }}
          aria-hidden
        />
        <span
          className="absolute -translate-x-1/2 rounded-full bg-brand"
          style={{
            top: trackTop(HISTORY_DOT),
            height: HISTORY_DOT,
            width: HISTORY_DOT,
            left: valueToPercent(value),
          }}
          aria-hidden
        />
      </div>
      <ScaleHearts value={value} className="flex-none text-[11px] font-semibold text-ink" />
    </div>
  );
}

export function HistoryChangeRow({
  change,
  footer,
}: {
  change: HistoryAxisChange;
  /**
   * v1.7 — AI 맥락 요약 슬롯(§29).
   * 규칙이 만든 `change.note` **뒤**에 온다. 변화 판정은 이미 위에서 끝났다.
   */
  footer?: ReactNode;
}) {
  const hasText = Boolean(change.previousText || change.currentText);

  return (
    <li className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-body font-semibold tracking-[-0.2px]">{change.label}</h3>
        <span
          className={cn(
            'flex-none rounded-[5px] px-2 py-1 text-[10px] font-semibold',
            STATE_CLASS[change.state],
          )}
        >
          {HISTORY_STATE_LABEL[change.state]}
        </span>
      </div>

      {change.declaredDelta ? (
        <div className="flex flex-col gap-2 rounded-[10px] bg-sunken px-3 py-3">
          <ScaleTrack label={HISTORY_COPY.pastLabel} value={change.declaredDelta.past} />
          <ScaleTrack label={HISTORY_COPY.nowLabel} value={change.declaredDelta.now} />
        </div>
      ) : null}

      {hasText ? (
        <dl className="flex flex-col gap-2">
          <div className="flex gap-2.5">
            <dt className="w-[34px] flex-none text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
              {HISTORY_COPY.pastLabel}
            </dt>
            <dd className="min-w-0 text-[12.5px] keep-all leading-relaxed text-ink-sub">
              {change.previousText ?? '기록 없음'}
            </dd>
          </div>
          <div className="flex gap-2.5">
            <dt className="w-[34px] flex-none text-[10px] font-semibold tracking-[0.06em] text-brand-pressed">
              {HISTORY_COPY.nowLabel}
            </dt>
            <dd className="min-w-0 text-[12.5px] keep-all leading-relaxed text-ink">
              {change.currentText ?? '기록 없음'}
            </dd>
          </div>
        </dl>
      ) : null}

      <p className="border-t border-line-soft pt-2.5 text-[12.5px] keep-all leading-relaxed text-[#555]">
        {change.note}
      </p>

      {footer}
    </li>
  );
}
