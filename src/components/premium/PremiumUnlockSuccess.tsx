import { LovyNote } from '@/components/lovy/LovyNote';
import { DEEP_REPORT_COPY, UNLOCK_COPY } from '@/data/premium';
import { cn } from '@/lib/cn';
import { formatPrice, priceForScreenReader } from '@/lib/premiumVariant';
import type { PremiumAccessMode } from '@/lib/premiumAccess';

/**
 * Premium Unlock Success (vNext)
 *
 * 결제/미리보기가 **이미 확정된 뒤** 잠깐 머무는 상태 화면. 여기서 무언가를 처리하지 않는다 —
 * presentation layer 전용이다. 실제 PG가 붙으면 성공 callback에서 `mode="payment"`로
 * 같은 컴포넌트를 그대로 쓴다.
 *
 * 시각 규칙(§3/§7):
 *   - 자물쇠가 열리거나 금색 Premium effect가 터지지 않는다. confetti 금지.
 *   - '결제 성공!' · '축하합니다!' 같은 일반 SaaS 문구를 쓰지 않는다.
 *   - LOCKED → **OBSERVATION COMPLETE** → REPORT AVAILABLE 의 느낌으로 말한다.
 *
 * 레이아웃 연속성(§6):
 *   맨 위 eyebrow(`PRECISION REPORT`)를 Paywall 헤더 Tag → 이 화면 → Report Header까지
 *   **같은 자리에 같은 문자열**로 둔다. shared-element transition 라이브러리를 새로 넣지
 *   않고 layout continuity만으로 '같은 것이 이어진다'는 느낌을 만든다.
 */
export function PremiumUnlockSuccess({
  mode,
  price,
  /** 이 세션에서 실제로 계산된 Cross-source Insight 개수. 가짜 숫자를 만들지 않는다(§7). */
  connectedSignalCount,
  animate,
  leaving,
}: {
  mode: PremiumAccessMode;
  price: number;
  connectedSignalCount: number;
  /** prefers-reduced-motion이면 false — 등장 애니메이션 없이 즉시 최종 상태로 둔다 */
  animate: boolean;
  /** Report에 자리를 넘기는 중 */
  leaving: boolean;
}) {
  const copy =
    mode === 'payment'
      ? UNLOCK_COPY.payment
      : mode === 'beta_ut'
        ? UNLOCK_COPY.betaUt
        : UNLOCK_COPY.preview;

  // 실제 결제일 때만 가격을 말한다. 미리보기에서 '₩1,900'을 보여주면 결제로 오해된다.
  const note =
    mode === 'payment' ? `${formatPrice(price)} · ${copy.noteSuffix}` : copy.noteSuffix;

  return (
    <div
      className={cn(
        'flex flex-col gap-5 pt-2',
        animate && !leaving && 'unlock-enter',
        leaving && 'unlock-exit',
      )}
    >
      {/* Paywall 헤더 Tag → 여기 → Report Header 로 이어지는 같은 라벨 */}
      <p className="px-1 text-[10px] font-semibold tracking-[0.18em] text-ink-faint">
        {DEEP_REPORT_COPY.entryLabel}
      </p>

      <div className="flex flex-col gap-3 px-1">
        <CheckIndicator animate={animate} />

        <div className="flex flex-col gap-1.5">
          <h1
            className="text-[24px] font-semibold leading-[1.34] tracking-[-0.7px] keep-all"
            role="status"
          >
            {copy.status}
          </h1>
          <p className="text-[12.5px] text-ink-muted">
            {note}
            {mode === 'payment' ? (
              <span className="sr-only"> ({priceForScreenReader(price)})</span>
            ) : null}
          </p>
        </div>
      </div>

      <LovyNote className="mx-1">{UNLOCK_COPY.lovy}</LovyNote>

      {/*
        §7 — 자물쇠가 아니라 '관찰이 한 겹 더 끝났다'로 말한다.
        숫자는 이 세션에서 실제로 계산된 Cross-source Insight 개수뿐이다.
      */}
      <div className="mx-1 flex items-baseline justify-between gap-3 border-t border-line-soft pt-3">
        <span className="text-[10px] font-semibold tracking-[0.16em] text-ink-faint">
          {UNLOCK_COPY.progressLabel}
        </span>
        <span className="text-[12.5px] text-ink-sub tnum">
          연결된 신호 {connectedSignalCount}개
        </span>
      </div>

      {/* 모션이 꺼져 있어도 '지금 무슨 일이 일어나는지'가 텍스트로 전달돼야 한다 */}
      <p className="sr-only" aria-live="polite">
        {UNLOCK_COPY.liveStatus}
      </p>
    </div>
  );
}

/**
 * 작은 check indicator.
 *
 * 초록색 성공 체크 + 폭죽이라는 상투적 조합을 쓰지 않는다 — 브랜드 Purple의 얇은 stroke만
 * 그린다. ring이 먼저 그려지고 check가 뒤따른다(약 320ms + 220ms).
 */
function CheckIndicator({ animate }: { animate: boolean }) {
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11 flex-none" aria-hidden focusable="false">
      <circle
        className={animate ? 'check-ring' : undefined}
        cx={22}
        cy={22}
        r={21}
        fill="none"
        stroke="var(--color-brand-edge)"
        strokeWidth={1.5}
        transform="rotate(-90 22 22)"
      />
      <path
        className={animate ? 'check-mark' : undefined}
        d="M14 22.5 L19.6 28 L30 16.8"
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
