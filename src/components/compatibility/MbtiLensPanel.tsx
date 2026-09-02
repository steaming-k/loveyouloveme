import { cn } from '@/lib/cn';
import type { MbtiAxisComparison, MbtiLensReport } from '@/types';

/**
 * MBTI Lens 패널 — Supporting Lens
 *
 * 정보 위계상 항상 실제 관계 신호(Good/Friction Signal) **뒤에** 온다.
 * 시각적으로도 관계 신호 카드보다 강해지지 않도록 중립 톤(sunken/line)만 쓰고,
 * 유형별 색상·궁합표·퍼센트 같은 표현은 쓰지 않는다.
 */

/** 같음/다름을 '좋음/나쁨'으로 읽히게 하지 않는다 — 색이 아니라 라벨로 구분한다. */
function AxisRow({ axis }: { axis: MbtiAxisComparison }) {
  return (
    <li className="flex flex-col gap-2 border-t border-line-soft pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
            {axis.eyebrow}
          </p>
          <p className="text-caption font-medium keep-all">{axis.label}</p>
        </div>

        <div className="flex flex-none items-center gap-1.5">
          <span className="rounded-[6px] bg-sunken px-2 py-1 text-[12px] font-semibold tnum text-ink">
            {axis.mineLetter}
          </span>
          <span className="text-[11px] text-ink-faint" aria-hidden>
            ↔
          </span>
          <span className="rounded-[6px] bg-sunken px-2 py-1 text-[12px] font-semibold tnum text-ink">
            {axis.theirsLetter}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span
          className={cn(
            'self-start rounded-[5px] px-1.5 py-0.5 text-[10px] font-semibold',
            axis.same ? 'bg-mint-tint text-mint-text' : 'bg-chip text-ink-muted',
          )}
        >
          {axis.same ? '비슷한 성향' : '다르게 나타날 수 있는 성향'}
        </span>
        <p className="text-[12.5px] keep-all leading-relaxed text-[#555]">{axis.note}</p>
      </div>
    </li>
  );
}

export function MbtiLensPanel({
  report,
  /** 축별 상세를 모두 보여줄지. S22에서는 요약만, 상세 화면에서는 전체를 보여준다 */
  variant = 'full',
}: {
  report: MbtiLensReport;
  variant?: 'summary' | 'full';
}) {
  return (
    <div className="flex flex-col gap-3.5 rounded-card border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold tracking-[0.05em] text-ink-muted">나</p>
          <p className="text-body font-semibold tracking-[-0.2px]">{report.mine}</p>
        </div>
        <span className="flex-none text-[13px] text-ink-faint" aria-hidden>
          ×
        </span>
        <div className="min-w-0 text-right">
          <p className="text-[10.5px] font-semibold tracking-[0.05em] text-ink-muted">상대</p>
          <p className="text-body font-semibold tracking-[-0.2px]">{report.theirs}</p>
        </div>
      </div>

      <p className="rounded-[10px] bg-sunken px-3 py-2.5 text-[12.5px] keep-all leading-relaxed text-ink-sub">
        유형 자체로 관계의 좋고 나쁨을 판정할 수는 없어. 대신 서로 다르게 반응할 수 있는 대화
        주제를 살펴볼 수 있어.
      </p>

      {variant === 'full' ? (
        <ul className="flex flex-col gap-3">
          {report.axes.map((axis) => (
            <AxisRow key={axis.key} axis={axis} />
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] text-ink-sub">
          4개 선호 지표 중 <b className="font-semibold text-ink">{report.sameCount}개</b>가 비슷하고,{' '}
          <b className="font-semibold text-ink">{report.differentCount}개</b>는 다르게 나타날 수
          있어.
        </p>
      )}
    </div>
  );
}
