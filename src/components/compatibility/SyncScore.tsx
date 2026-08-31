import { COMPATIBILITY_COPY } from '@/data/copy';

/**
 * Compatibility Hero 의 동기화율 (S21)
 *
 * 숫자는 요약일 뿐이라는 것이 화면에서도 읽혀야 하므로,
 * 점수 아래에 근거 문장과 '연애 성공확률이 아니에요' 고지를 항상 붙인다.
 *
 * 리빌 연출은 CSS 애니메이션으로 처리한다. 숫자를 state로 카운트업하거나
 * JS로 transform을 붙이면 SSR 결과와 첫 클라이언트 렌더가 달라져 hydration이 깨진다.
 */
export function SyncScore({ score }: { score: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 pt-3.5 pb-1.5">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-muted">
        {COMPATIBILITY_COPY.scoreLabel}
      </p>

      <p className="reveal-score text-[96px] font-semibold leading-[1.05] tracking-[-5px] text-brand tnum">
        {score}
      </p>

      <p className="mt-1.5 text-center text-caption leading-relaxed text-ink-sub">
        {COMPATIBILITY_COPY.supporting.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </p>

      <p className="mt-2 rounded-tag bg-sunken px-2.5 py-1.5 text-meta text-ink-sub">
        {COMPATIBILITY_COPY.notice}
      </p>
    </div>
  );
}
