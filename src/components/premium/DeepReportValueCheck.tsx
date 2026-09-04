'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/cn';
import { trackEvent } from '@/lib/analytics';
import { getDeepReportUt, saveDeepReportUtAnswer } from '@/lib/deepReportUtStore';
import { formatPrice } from '@/lib/premiumVariant';

/**
 * Deep Report Value Check (v1.19 · §10~§12 · §25)
 *
 * 리포트를 **다 본 뒤에만** 나타나는 2문항. `UtRatingCard`/`DeepReportUtFlow`와 달리
 * `UT_MODE` 게이트가 없다 — Production 사용자에게도 필요한 질문이기 때문이다(§25).
 * 그래서 'UT' · '테스트' · '참가자' 같은 연구자용 문구를 쓰지 않는다.
 *
 * ⚠️ 무엇을 재는가:
 *   Q1 `deep_report_value_rating`   — 무료 대비 **추가 가치**(§14 D)
 *   Q2 `deep_report_wtp_after_view` — **보고 난 뒤**의 지불 의향(§14 E)
 *
 * Q2는 Paywall의 `premium_purchase_intent`(보기 **전** 기대 가치)와 절대 같은 지표로 묶지
 * 않는다(§11). 둘 다 '의향'이며 실제 결제가 아니다 — GA4 purchase/revenue로도 보내지 않는다(§5).
 *
 * ⚠️ 자유서술 입력란을 두지 않는다(§10/§24) — 관계 관련 민감 정보가 Analytics 경로에
 * 흘러들 수 있다. 정량 2문항만 받는다.
 *
 * ⚠️ **`analysis_id`를 Analytics로 보내지 않는다.** 이 값은 declared/experience에서 파생한
 * deterministic fingerprint라(`analysisFingerprint`) 문자열 자체가 사용자의 실제 답변
 * 조합을 그대로 담고 있다 — 예: `solo_exp|2|now|5|a2|h3|…|contact_drop|yes|…`. 자유서술은
 * 아니지만, 카테고리 값 하나가 아니라 **답변 프로필 전체를 복원할 수 있는 문자열**이라
 * 외부 Analytics에 남길 이유가 없다(§24). 로컬 저장소(`lym.ut.deep.v1`)에는 그대로 쓴다 —
 * 같은 분석에 응답을 묶어두려면 필요하고, 그건 기기 밖으로 나가지 않는다.
 *
 * 분석 단위 join은 `funnel_analysis_id`(random UUID)가 대신한다 — 호출부가 `properties`로
 * 넘겨주며, Premium Funnel 전 구간과 같은 값이라 Hook → Paywall → Report를 이어 붙일 수 있다.
 *
 * ⚠️ 이 응답은 분석 로직에 전혀 쓰이지 않는다. `lym.session.v1`이 아니라 `lym.ut.deep.v1`
 * (`deepReportUtStore`)에 `analysisId` 기준으로만 저장돼서, 같은 분석을 다시 봐도 이미
 * 답한 질문을 다시 묻지 않는다.
 */

const SCALE = [1, 2, 3, 4, 5] as const;

type WtpAfterView = 'yes' | 'maybe' | 'no';

const WTP_OPTIONS: readonly { value: WtpAfterView; label: string }[] = [
  { value: 'yes', label: '결제할 의향이 있어' },
  { value: 'maybe', label: '결과를 조금 더 봐야 판단할 수 있어' },
  { value: 'no', label: '무료 결과로 충분해' },
];

export function DeepReportValueCheck({
  analysisId,
  price,
  properties,
}: {
  analysisId: string;
  price: number;
  /** access_mode 등 공통 property. ⚠️ 자유서술·AI 문장은 넣지 않는다(§24) */
  properties?: Record<string, string | number | boolean>;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [wtp, setWtp] = useState<WtpAfterView | null>(null);

  // 같은 분석을 다시 열었을 때 이미 답한 것은 잠긴 상태로 복원한다.
  useEffect(() => {
    const saved = getDeepReportUt(analysisId);
    if (saved?.valueRating) setRating(saved.valueRating);
    if (saved?.wtpAfterView) setWtp(saved.wtpAfterView);
  }, [analysisId]);

  return (
    <section
      className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
      aria-label="리포트 평가"
    >
      <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted">
        두 가지만 물어볼게
      </p>

      <div className="flex flex-col gap-2.5">
        <p className="text-caption keep-all leading-relaxed">
          무료 결과보다 더 깊게 이해하는 데 도움이 됐어?
        </p>
        <div className="flex gap-1.5" role="group" aria-label="무료 결과 대비 도움 정도">
          {SCALE.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={rating === value}
              disabled={rating !== null}
              onClick={() => {
                setRating(value);
                saveDeepReportUtAnswer(analysisId, { valueRating: value });
                trackEvent('deep_report_value_rating', { ...properties, score: value });
              }}
              className={cn(
                'min-h-11 flex-1 rounded-[10px] border text-[13px] tnum transition-colors duration-200',
                rating === value
                  ? 'border-brand bg-brand-tint font-semibold text-ink'
                  : 'border-line bg-surface text-ink-sub',
                rating !== null && rating !== value && 'opacity-45',
              )}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="flex justify-between px-1 text-[10.5px] keep-all text-ink-faint">
          <span>전혀 아니야</span>
          <span className="text-right">매우 그래</span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-line-soft pt-4">
        <p className="text-caption keep-all leading-relaxed">
          이 정도 결과라면 {formatPrice(price)}을 내고 볼 의향이 있어?
        </p>
        <p className="text-[10.5px] keep-all text-ink-faint">
          실제 결제가 아니라 의향을 묻는 질문이야.
        </p>
        <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="결제 의향">
          {WTP_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={wtp === option.value}
              disabled={wtp !== null}
              onClick={() => {
                setWtp(option.value);
                saveDeepReportUtAnswer(analysisId, { wtpAfterView: option.value });
                trackEvent('deep_report_wtp_after_view', {
                  ...properties,
                  price,
                  choice: option.value,
                });
              }}
              className={cn(
                'min-h-11 rounded-[10px] border px-3.5 py-2.5 text-left text-caption disabled:opacity-60',
                wtp === option.value
                  ? 'border-brand bg-brand-tint font-semibold text-ink'
                  : 'border-line bg-surface active:bg-sunken',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {rating !== null || wtp !== null ? (
        <p className="px-1 text-[10.5px] keep-all leading-relaxed text-ink-muted" role="status">
          기록했어. 이 답변은 분석 결과에 반영되지 않고, 실제 결제로도 이어지지 않아.
        </p>
      ) : null}
    </section>
  );
}
