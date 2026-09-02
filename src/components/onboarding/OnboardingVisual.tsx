import { Lovy } from '@/components/lovy/Lovy';
import { ONBOARDING_SLIDES } from '@/data/copy';
import { LOVY_VISUAL_SCALE } from '@/data/lovy';

/** 온보딩 01 — 나와 상대의 신호를 항목별로 비교한다는 것을 그림으로 먼저 보여준다 */
const SIGNAL_ROWS = [
  { mine: 64, theirs: 58, diverges: false },
  { mine: 40, theirs: 76, diverges: false },
  { mine: 72, theirs: 34, diverges: true },
  { mine: 52, theirs: 50, diverges: false },
] as const;

export function SignalPreview({ caption }: { caption: readonly string[] }) {
  return (
    <div className="flex flex-col gap-3.5 rounded-card border border-line bg-surface px-[18px] py-5">
      <div className="flex justify-between text-[11px] font-semibold tracking-[0.06em] text-ink-muted">
        <span>나</span>
        <span>SIGNAL</span>
        <span>그 사람</span>
      </div>

      <div className="flex flex-col gap-[11px]" aria-hidden>
        {SIGNAL_ROWS.map((row, index) => (
          <div key={index} className="flex items-center gap-2.5">
            <span className="h-2 rounded-full bg-brand" style={{ width: row.mine }} />
            <span
              className={
                row.diverges
                  ? 'h-px flex-1 border-t border-dashed border-friction'
                  : 'h-px flex-1 bg-line'
              }
            />
            <span className="h-2 rounded-full bg-brand-soft" style={{ width: row.theirs }} />
          </div>
        ))}
      </div>

      <p className="text-meta leading-relaxed text-ink-sub">
        {caption.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </p>
    </div>
  );
}

/** 온보딩 02 — Declared Me vs Relationship Me 의 어긋남을 미리 예고한다 */
export function GapPreview() {
  const gap = ONBOARDING_SLIDES[1].gap;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[16px] border border-dashed border-dash bg-surface px-[18px] py-4">
        <p className="mb-2 text-[11px] font-semibold tracking-[0.06em] text-ink-muted">
          {gap.declaredLabel}
        </p>
        <p className="text-body keep-all">{gap.declaredText}</p>
      </div>

      <div className="flex items-center gap-2 pl-[18px]">
        <span className="h-4 w-px bg-friction" aria-hidden />
        <span className="text-[11px] font-semibold text-friction-text">GAP</span>
      </div>

      <div className="rounded-[16px] border border-brand bg-brand-tint px-[18px] py-4">
        <p className="mb-2 text-[11px] font-semibold tracking-[0.06em] text-brand-pressed">
          {gap.relationshipLabel}
        </p>
        <p className="text-body keep-all">{gap.relationshipText}</p>
      </div>
    </div>
  );
}

/**
 * 온보딩 03 — 실제 화면에 보이던 크기(부모 폭 327px에 꽉 차 있던 상태)에서 30% 축소.
 * 이전 `CRYSTAL_BASE_SIZE=300`은 배율(1.35)을 곱해도 405px라 부모 폭(327px)에
 * 걸려 항상 327px로 꽉 차게 렌더됐다 — 그래서 상한(maxWidth) 자체를 부모 폭보다
 * 작게 낮춰야 실제로 작아진다.
 */
const CRYSTAL_BASE_SIZE = 170;

export function LovyPreview() {
  /**
   * `Lovy`가 `size`에 포즈별 배율(`LOVY_VISUAL_SCALE`)을 곱해 렌더 크기를 정하는데,
   * 이 화면은 그 결과를 `w-full`로 다시 부모 폭에 맞춰 늘린다 — 두 값이 따로 있으면
   * Lovy 내부에서 커진 크기를 이 래퍼의 고정 max-width가 도로 눌러버린다(실측으로 확인:
   * size=300·crystal 배율 1.35를 곱해도 max-w-[300px]에 걸려 항상 300px로 렌더됐다).
   *
   * 그래서 상한을 여기서 하드코딩하지 않고 같은 배율로 계산한다 — 배율이 바뀌면
   * 이 상한도 같이 움직인다. 실제 렌더 폭은 `min(부모 폭, 이 상한)`이라 화면이 좁으면
   * 자연히 더 작게 나오고, 넓은 프레임에서는 보정된 크기까지 커진다.
   */
  const maxWidth = Math.round(CRYSTAL_BASE_SIZE * LOVY_VISUAL_SCALE.crystal);

  return (
    <div className="mt-1 w-full self-center" style={{ maxWidth }}>
      <Lovy pose="crystal" size={CRYSTAL_BASE_SIZE} decorative className="w-full" />
    </div>
  );
}
