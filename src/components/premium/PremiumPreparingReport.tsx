import { Lovy } from '@/components/lovy/Lovy';
import { LOVY_SIZE } from '@/lib/premiumLovy';
import { cn } from '@/lib/cn';

/**
 * Premium Preparing Report (v1.45 PostReview §4-1 · §4-2)
 *
 * ══ 왜 이 화면이 생겼나 ═══════════════════════════════════════════════════
 *
 * Unlock 직후 바로 긴 리포트가 나타나면 '결제하니까 글이 쏟아진다'로 읽힌다.
 * 사용자 검토에서 요청받은 것은 그 사이에 러비가 **관찰을 연결하는 장면**을 두어
 * 제품 세계관과 유료 payoff를 잇는 것이다:
 *
 * ```
 * 결제/Unlock 확인  →  러비가 관찰을 연결하는 짧은 장면  →  리포트
 * ```
 *
 * ══ ⚠️ 이 화면이 하지 않는 것 ══════════════════════════════════════════════
 *
 * ⚠️ **연출이지 처리가 아니다**(§4-5). 여기서 분석을 다시 요청하지 않는다 — Deep
 * Report는 이미 `useDeepReport(stage !== 'paywall')`로 Unlock 시점부터 만들어지고
 * 있고, 이 화면은 그 계산이 끝나는 동안 보이는 자리다. **Provider 호출은 1회 그대로다.**
 *
 * ⚠️ **무한 로딩을 만들지 않는다.** 이 화면의 체류 시간은 고정 타이머이고 AI 상태를
 * 기다리지 않는다. AI가 늦으면 리포트가 규칙 문장으로 먼저 완결되고, AI 배지·재시도는
 * 리포트 안에서 처리한다(§11.3에서 정한 방식 그대로) — 여기서 기다리면 실패한 AI 때문에
 * 리포트 자체가 열리지 않는 경로가 생긴다.
 *
 * ⚠️ **'결제 완료'라고 말하지 않는다.** 문구는 전부 관찰·연결에 대한 것이다. 실제 PG가
 * 없는 지금 이 화면은 Preview/UT의 mock success 경로에서만 보이고(§4-1), Production
 * Fake Door는 이 stage에 **진입하지 않는다.**
 *
 * ⚠️ **고정 문구다.** 사용자별 해석을 쓰지 않는다 — 숫자도 넣지 않는다(그 시점에
 * Chapter 수가 확정됐다고 보장할 수 없고, 확정됐더라도 여기서 말하면 리포트 헤더와
 * 같은 숫자를 두 번 말하게 된다).
 */

/** 관찰 → 연결 → 리포트. 지금 어디인지를 3단계로만 보여준다 */
const STEPS = ['관찰', '연결', '리포트'] as const;

export function PremiumPreparingReport({
  /** prefers-reduced-motion이면 false — 진행 표시를 움직이지 않는다 */
  animate,
}: {
  animate: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center gap-4 pt-8"
      /**
       * 스크린리더에는 **한 번만** 읽힌다. `aria-live`를 쓰지 않는 것은 의도다 —
       * 곧 리포트가 열리므로 두 번 말할 이유가 없다.
       */
      role="status"
    >
      <Lovy pose="connect" size={LOVY_SIZE.preparing} decorative float={animate ? 'fast' : false} />

      <div className="flex flex-col items-center gap-1.5">
        <p className="text-[15px] font-semibold keep-all">관찰한 내용을 연결하고 있어</p>
        <p className="max-w-[19rem] text-center text-[12.5px] keep-all leading-relaxed text-ink-sub">
          네가 말한 기준과 관계에서 보인 신호를 같이 놓는 중이야.
        </p>
      </div>

      {/*
        3-step indicator. 마지막 단계(`리포트`)는 아직 도달하지 않았으므로 흐리게 둔다 —
        진행률을 숫자로 만들지 않는다(가짜 퍼센트를 만들지 않는다).
      */}
      <ol className="flex items-center gap-1.5" aria-hidden>
        {STEPS.map((step, index) => (
          <li key={step} className="flex items-center gap-1.5">
            <span
              className={cn(
                'rounded-pill px-2.5 py-1 text-[10.5px] font-semibold tracking-[0.04em]',
                index < STEPS.length - 1
                  ? 'bg-brand-tint text-brand-ink'
                  : 'bg-sunken text-ink-faint',
              )}
            >
              {step}
            </span>
            {index < STEPS.length - 1 ? (
              <span className="text-[10px] text-line-strong">›</span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
