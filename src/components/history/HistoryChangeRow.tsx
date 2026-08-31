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

const STATE_CLASS: Record<HistoryChangeState, string> = {
  STABLE: 'bg-mint-tint text-mint-text',
  SHIFT: 'bg-brand-tint text-brand-pressed',
  NEW: 'bg-chip text-ink',
  INSUFFICIENT: 'bg-sunken text-ink-muted',
};

function ScaleTrack({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[34px] flex-none text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
        {label}
      </span>
      <div className="relative h-[3px] min-w-0 flex-1 rounded-sm bg-track">
        <span
          className="absolute top-1/2 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand"
          style={{ left: valueToPercent(value) }}
          aria-hidden
        />
      </div>
      <span className="w-[26px] flex-none text-right text-[11px] font-semibold tnum text-ink">
        {value}/5
      </span>
    </div>
  );
}

export function HistoryChangeRow({ change }: { change: HistoryAxisChange }) {
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
    </li>
  );
}
