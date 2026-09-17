import type { PremiumActionPlan } from '@/types';

/**
 * v1.46.4 Premium Action Layer — **지금 가장 먼저 확인할 것** (§3 · §18 · §19)
 *
 * Top 3 카드 아래 **하나뿐인** 블록이다. 카드마다 행동을 붙이지 않는다 — 우선순위를 주는 것이
 * 이 블록의 역할이다(정보 과부하 방지 · 실행 부담 감소).
 *
 * ⚠️ **문장을 만들지 않는다.** 전부 `buildPremiumActionPlan`이 조립한 값이다. 라벨만 시제를 따른다.
 * ⚠️ 내부 점수(`priorityScore`)는 여기 오지 않는다(§17).
 */
const LABELS = {
  current: {
    eyebrow: '지금 가장 먼저 확인할 것',
    move: '지금 해볼 것',
    ask: '이렇게 물어볼 수 있어',
  },
  former: {
    eyebrow: '다음을 위해 먼저 정리할 것',
    move: '다음 관계에서 먼저 확인할 것',
    ask: '스스로 돌아볼 질문',
  },
} as const;

export function PremiumActionPlanSection({ plan }: { plan: PremiumActionPlan }) {
  const labels = LABELS[plan.lifecycle];

  return (
    <section className="flex flex-col gap-2.5" aria-label={labels.eyebrow}>
      <p className="px-1 text-[11px] font-semibold tracking-[0.04em] text-mint-ink">{labels.eyebrow}</p>
      <div className="flex flex-col gap-3 rounded-card border border-brand-soft bg-surface px-4 py-3.5">
        <div className="flex flex-col gap-1">
          <p className="text-[14px] font-semibold keep-all leading-snug">{plan.title}</p>
          {plan.priorityReason ? (
            <p className="text-[11.5px] keep-all leading-relaxed text-ink-muted">
              <span className="font-semibold">왜 이걸 먼저 볼까? </span>
              {plan.priorityReason}
            </p>
          ) : null}
        </div>

        {plan.nextMove ? (
          <Row label={labels.move}>
            <p className="text-[13.5px] font-semibold keep-all leading-relaxed">{plan.nextMove}</p>
          </Row>
        ) : null}

        {/*
          §8 · §31 — 카드 VERIFY를 재사용했으면 **원문을 다시 적지 않는다.** 393px 실측에서 같은
          질문이 카드와 이 블록에 연달아 보였다. 어느 카드인지만 가리킨다.
        */}
        {plan.verificationQuestion && plan.verificationFrom === 'card' ? (
          <Row label={labels.ask}>
            <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">
              위 {String(plan.sourceRank).padStart(2, '0')} 카드의 질문으로 시작하면 돼.
            </p>
          </Row>
        ) : plan.verificationQuestion ? (
          <Row label={labels.ask}>
            <p className="rounded-row bg-brand-tint px-3 py-2.5 text-[12.5px] keep-all leading-relaxed text-brand-pressed">
              “{plan.verificationQuestion}”
            </p>
          </Row>
        ) : null}

        {plan.observeSignal ? (
          <Row label="그다음에는 이것만 봐">
            <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">{plan.observeSignal}</p>
          </Row>
        ) : null}

        {plan.decisionSignals.length > 0 ? (
          <Row label="판단할 때는">
            <ul className="flex flex-col gap-2">
              {plan.decisionSignals.map((signal, index) => (
                <li key={index} className="flex flex-col gap-0.5 rounded-row bg-sunken px-3 py-2.5">
                  <p className="text-[12px] font-semibold keep-all leading-relaxed text-ink">
                    {signal.ifObserved}
                  </p>
                  <p className="text-[12px] keep-all leading-relaxed text-ink-sub">→ {signal.interpretation}</p>
                </li>
              ))}
            </ul>
          </Row>
        ) : null}

        {plan.unresolved ? (
          <Row label="아직 구분되지 않은 것">
            <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">{plan.unresolved}</p>
          </Row>
        ) : null}
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] font-semibold tracking-[0.04em] text-ink-faint">{label}</p>
      {children}
    </div>
  );
}
