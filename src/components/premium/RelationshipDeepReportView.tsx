'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/common/Button';
import { NoticeBox, SectionLabel } from '@/components/common/primitives';
import { AiNarrativeNotice, AiSourceLabel } from '@/components/ai/AiModeNotice';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { DeepInsightCard } from '@/components/premium/DeepInsightCard';
import { DeepReportValueCheck } from '@/components/premium/DeepReportValueCheck';
import { PremiumDetailView } from '@/components/premium/PremiumDetailView';
import { DeepReportUtFlow } from '@/components/ut/DeepReportUtFlow';
import type { EvidenceResolverContext } from '@/lib/aiEvidenceResolver';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { UT_MODE } from '@/lib/env';
import { hasCompletedDeepReport, markDeepReportCompleted } from '@/lib/deepReportUtStore';
import { resolvePrice, resolvePriceVariant } from '@/lib/premiumVariant';
import { axisLabel } from '@/services/premiumService';
import type { AiFailureReason, AiMode, AiNarrativeStatus, RelationshipDeepReport } from '@/types';

/**
 * Relationship Deep Report — "러비의 정밀 관찰 리포트" (v1.9 · §13~§23, v1.10 §11~§25/§48~§49)
 *
 * 8개 섹션 순서를 그대로 지킨다: Overview → Relationship Self → Cross-source Insights →
 * Compatibility Deep Dive → Situations → Conversation Questions → History Deep →
 * Final Observation. 데이터가 없는 섹션은 만들어내지 않고 **숨긴다**(§42) — 그래서 이 파일은
 * 각 섹션을 조건부로만 렌더한다.
 *
 * `analysisId`는 Deep Report UT 응답을 이 분석에 묶어두는 키다(§20) — Compatibility/Mirror/
 * History 계산에는 전혀 쓰이지 않는다.
 */
export function RelationshipDeepReportView({
  report,
  resolverContext,
  analysisId,
  funnelAnalysisId,
  accessMode = 'preview',
  header,
  reveal = false,
  aiNarrative,
}: {
  report: RelationshipDeepReport;
  resolverContext: EvidenceResolverContext;
  analysisId: string;
  /**
   * v1.19 §3 — Premium Funnel(entry_view → … → purchase_intent)이 쓰는 것과 같은 키.
   * Hook에서 시작한 Funnel과 이 리포트의 열람/완독/사후 평가를 GA4에서 이어 붙이려면
   * 두 구간이 같은 값을 갖고 있어야 한다. 위 analysisId는 declared/experience 기반
   * deterministic fingerprint라 의미가 다르므로 대체하지 않고 나란히 보낸다.
   */
  funnelAnalysisId?: string | null;
  /**
   * v1.10 §72 — 실제 Payment로 오해되지 않도록 어느 경로로 이 화면에 왔는지 남긴다.
   * vNext — `payment`를 추가했다. **아직 도달 경로가 없다**(PG 미연결) — 실제 결제가
   * 붙었을 때 `access_mode`로 preview/UT와 구분하기 위한 자리다(`lib/premiumAccess.ts`).
   */
  accessMode?: 'payment' | 'preview' | 'beta_ut';
  /**
   * vNext — 리포트 맨 위에 놓을 Report Header 슬롯. Unlock 직후의 `/premium`에서
   * v1.20 `ReportShell`의 `ReportHeader`를 넘겨, 무료 관찰 보고서와 같은 디자인 언어로
   * '러비가 만든 산출물'처럼 읽히게 한다. 넘기지 않으면 기존 동작 그대로다.
   */
  header?: ReactNode;
  /**
   * vNext — 섹션을 위에서부터 짧게 stagger해서 등장시킨다(`.report-reveal`).
   * ⚠️ 콘텐츠를 늦게 만들거나 늦게 가져오지 않는다 — 렌더 순서만 조절한다.
   */
  reveal?: boolean;
  /**
   * v1.17 — Cross-source Insight Narrative 생성 상태. 무료 화면(S22/S27/S28/F2)의
   * `AiNarrativeNotice`/`AiSourceLabel`와 같은 컴포넌트를 재사용한다 — 대가를 지불한
   * 화면이라 실패 시에는(§10) `retry`로 재시도 버튼까지 보여준다는 점만 다르다.
   * 넘기지 않으면(개발용 Preview 등) 배지·안내를 그리지 않는다 — 기존 동작 그대로다.
   */
  aiNarrative?: {
    status: AiNarrativeStatus;
    reason: AiFailureReason | null;
    mode: AiMode | null;
    retry: () => void;
  };
}) {
  const viewSent = useRef(false);
  const [utOpen, setUtOpen] = useState(false);
  const [completed, setCompleted] = useState(false);
  const scrollDepthSent = useRef<{ 50: boolean; 100: boolean }>({ 50: false, 100: false });
  const rootRef = useRef<HTMLDivElement>(null);
  /** v1.19 §10 — 사후 평가에 보여줄 가격. Paywall과 같은 세션 고정 값을 쓴다 */
  const [price] = useState(() => resolvePrice(resolvePriceVariant()));
  const attribution: Record<string, string> = funnelAnalysisId
    ? { funnel_analysis_id: funnelAnalysisId }
    : {};

  useEffect(() => {
    // v1.19 §13 — UT 5문항 완료(`completedAt`)가 아니라 **리포트 완독**을 복원한다.
    // Production에는 UT 5문항이 없어서 예전 조건으로는 새로고침마다 완독이 초기화됐고,
    // 그러면 `deep_report_complete`가 중복 발생해 Completion Rate가 부풀었다.
    setCompleted(hasCompletedDeepReport(analysisId));
  }, [analysisId]);

  /**
   * Release Gate §3 — `deep_report_view`의 의미를 좁힌다.
   *   "사용자가 **유효한 Deep Report 콘텐츠를 볼 수 있는 상태**에서 리포트가 렌더됐다"
   *
   * 이전에는 이 effect가 아래 `if (!report.available) return`보다 **위**에 있어서, 연결할
   * 신호가 부족해 안내 문구만 보여주는 경우에도 view가 1건 발생했다. 그러면 Completion
   * Rate(`deep_report_complete / deep_report_view`)의 분모에 **완독할 콘텐츠가 애초에 없던
   * 세션**이 섞여서 완독률이 실제보다 낮게 나온다. 분모와 분자가 같은 eligible population을
   * 쓰도록 available일 때만 보낸다.
   *
   * 새 이벤트(예: deep_report_unavailable)는 만들지 않는다 — 그 상태는 이미 Paywall 쪽
   * `premiumFeatureState`의 unavailable 분기(가격·CTA 미노출)로 관측할 수 있고, 이벤트를
   * 늘리는 것보다 기존 Funnel을 깨끗하게 두는 편이 낫다.
   *
   * ⚠️ Release Gate §1 — `analysis_id`(deterministic fingerprint)를 더 이상 보내지 않는다.
   * 분석 단위 연결은 opaque한 `funnel_analysis_id`(attribution)가 맡는다.
   */
  useEffect(() => {
    if (!report.available) return;
    if (viewSent.current) return;
    viewSent.current = true;
    trackEvent('deep_report_view', {
      access_mode: accessMode,
      insight_count: report.crossSourceInsights.length + report.relationshipSelf.length,
      ...attribution,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.available, report.crossSourceInsights.length, report.relationshipSelf.length, accessMode, funnelAnalysisId]);

  // §49 — 50/100 두 단계만. 이 화면의 스크롤 조상(ScreenLayout의 overflow-y-auto body)을 찾는다.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let scrollParent: HTMLElement | null = root.parentElement;
    while (scrollParent && scrollParent !== document.body) {
      const style = window.getComputedStyle(scrollParent);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') break;
      scrollParent = scrollParent.parentElement;
    }
    if (!scrollParent || scrollParent === document.body) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollParent as HTMLElement;
      if (scrollHeight <= clientHeight) return;
      const percent = ((scrollTop + clientHeight) / scrollHeight) * 100;
      if (percent >= 100 && !scrollDepthSent.current[100]) {
        scrollDepthSent.current[100] = true;
        trackEvent('deep_report_scroll', { ...attribution, depth: 100 });
      } else if (percent >= 50 && !scrollDepthSent.current[50]) {
        scrollDepthSent.current[50] = true;
        trackEvent('deep_report_scroll', { ...attribution, depth: 50 });
      }
    };

    scrollParent.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollParent?.removeEventListener('scroll', handleScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funnelAnalysisId]);

  if (!report.available) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <NoticeBox>
          {report.limitations[0] ?? '아직 연결해서 볼 수 있는 신호가 부족해.'}
        </NoticeBox>
      </div>
    );
  }

  const handleReportComplete = () => {
    // 이미 완독으로 기록된 분석이면 이벤트를 다시 쏘지 않는다(§13/§14 C).
    if (!hasCompletedDeepReport(analysisId)) {
      trackEvent('deep_report_complete', { access_mode: accessMode, ...attribution });
      markDeepReportCompleted(analysisId);
    }
    setCompleted(true);
    if (UT_MODE) setUtOpen(true);
  };

  return (
    <div ref={rootRef} className={cn('flex flex-col gap-6', reveal && 'report-reveal')}>
      {header}

      {/* 01 Overview */}
      <section className="flex flex-col gap-2">
        <h2 className="text-section keep-all font-semibold">{report.overview.headline}</h2>
        <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">
          {report.overview.subcopy}
        </p>
      </section>

      {/*
        v1.17 — AI 상태 배지/실패 안내는 §02/§03 어느 한쪽에 종속시키지 않는다.
        `deepNarrative`는 relationshipSelf·crossSourceInsights 카드 전부에 공통으로 적용되는데,
        표본에 따라 모든 Insight가 §02(Relationship Self)로만 분류돼 §03이 통째로 숨는
        경우가 있다(Target을 가로지르는 연결이 하나도 없을 때) — 그 상태에서 실패 배지를
        §03 안에만 두면 실패해도 화면에 **아무 표시도 없이** 조용히 규칙 요약만 보여주게
        된다. Insight 카드가 하나라도 있으면(§02 또는 §03) 항상 여기서 보여준다.
      */}
      {aiNarrative && (report.relationshipSelf.length > 0 || report.crossSourceInsights.length > 0) ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-end gap-2">
            <AiSourceLabel mode={aiNarrative.mode} />
          </div>
          <AiNarrativeNotice
            task="deep-report-narrative"
            status={aiNarrative.status}
            reason={aiNarrative.reason}
            onRetry={aiNarrative.retry}
          />
        </div>
      ) : null}

      {/* 02 Relationship Self */}
      {report.relationshipSelf.length > 0 ? (
        <section className="flex flex-col gap-2.5">
          <SectionLabel>나의 관계 안에서</SectionLabel>
          <ul className="flex flex-col gap-2.5">
            {report.relationshipSelf.map((card) => (
              <DeepInsightCard
                key={card.insight.id}
                card={card}
                resolverContext={resolverContext}
                funnelAnalysisId={funnelAnalysisId}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {/* 03 Cross-source Insights — Premium의 핵심 */}
      {report.crossSourceInsights.length > 0 || report.approachInsight ? (
        <section className="flex flex-col gap-2.5">
          <SectionLabel>따로 있던 걸 연결해보면</SectionLabel>
          <ul className="flex flex-col gap-2.5">
            {report.crossSourceInsights.map((card) => (
              <DeepInsightCard
                key={card.insight.id}
                card={card}
                resolverContext={resolverContext}
                funnelAnalysisId={funnelAnalysisId}
              />
            ))}
          </ul>

          {/* v1.15 §5 — Target Preference × Target Axis × User Style. 다가가는 힌트(무료)를
              대체하지 않는다 — 여기에 내 축까지 한 겹 더 연결됐을 때만 보이는 문장 하나다. */}
          {report.approachInsight ? (
            <div className="flex flex-col gap-1.5 rounded-card border border-brand-edge bg-brand-tint p-4">
              <p className="text-[10px] font-semibold tracking-[0.06em] text-brand-pressed">
                다가가는 힌트 · 연결해서 보면
              </p>
              <p className="text-caption font-medium text-brand-ink">{report.approachInsight.title}</p>
              <p className="text-[12.5px] keep-all leading-relaxed text-brand-ink">
                {report.approachInsight.text}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* 04 Compatibility Deep Dive — 기존 buildCompatibilityDetail 재사용 */}
      {report.compatibilityDeepDive.available ? (
        <section className="flex flex-col gap-2.5">
          <SectionLabel>궁합 심화 비교</SectionLabel>
          <PremiumDetailView report={report.compatibilityDeepDive} />
        </section>
      ) : null}

      {/* 05 Relationship Situations */}
      {report.situations.length > 0 ? (
        <section className="flex flex-col gap-2.5">
          <SectionLabel>실제로 일어날 수 있는 상황</SectionLabel>
          <ul className="flex flex-col gap-2.5">
            {report.situations.map((situation) => (
              <li
                key={situation.id}
                className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4"
              >
                <p className="text-[11px] font-semibold tracking-[0.04em] text-ink-muted">
                  {axisLabel(situation.axis)}
                </p>
                <p className="text-[12.5px] keep-all leading-relaxed text-ink">
                  {situation.situation}
                </p>
                <dl className="flex flex-col gap-1.5 rounded-[10px] bg-sunken px-3 py-2.5">
                  <div className="flex gap-2.5">
                    <dt className="w-[34px] flex-none text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
                      나
                    </dt>
                    <dd className="min-w-0 text-[12.5px] keep-all">{situation.myReaction}</dd>
                  </div>
                  <div className="flex gap-2.5">
                    <dt className="w-[34px] flex-none text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
                      상대
                    </dt>
                    <dd className="min-w-0 text-[12.5px] keep-all">
                      {situation.theirPossibleReaction}
                    </dd>
                  </div>
                </dl>
                <p className="border-t border-line-soft pt-2 text-[12px] keep-all leading-relaxed text-[#555]">
                  {situation.misunderstanding}
                </p>
                <p className="text-[12px] font-medium keep-all text-brand-pressed">
                  {situation.question}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 06 Conversation Questions */}
      {report.conversationQuestions.length > 0 ? (
        <section className="flex flex-col gap-2.5">
          <SectionLabel>이야기해볼 질문</SectionLabel>
          <ul className="flex flex-col gap-2.5">
            {report.conversationQuestions.map((item) => (
              <li
                key={item.question.id}
                className="flex flex-col gap-1.5 rounded-row border border-line bg-surface px-3.5 py-3"
              >
                <p className="text-caption keep-all leading-relaxed">{item.question.text}</p>
                <p className="text-[11px] keep-all leading-relaxed text-ink-muted">{item.why}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 07 History Deep — 기존 buildHistoryDetail 재사용. 기록 2개 미만이면 섹션 자체가 없다 */}
      {report.historyDeep?.available ? (
        <section className="flex flex-col gap-2.5">
          <SectionLabel>과거 관찰과 지금</SectionLabel>
          <PremiumDetailView report={report.historyDeep} />
        </section>
      ) : null}

      {/* 08 Lovy Final Observation */}
      {report.finalObservation ? (
        <section className="flex flex-col gap-2.5">
          <SectionLabel>러비의 최종 관찰</SectionLabel>
          <LovyMessage pose="chart" size={52}>
            {report.finalObservation.strongestSignalSummary}
          </LovyMessage>
          {report.finalObservation.evidence.length > 0 ? (
            <ul className="flex flex-col gap-1.5 rounded-card border border-line bg-surface p-4">
              {report.finalObservation.evidence.map((text, index) => (
                <li key={index} className="text-[12px] keep-all leading-relaxed text-ink-sub">
                  · {text}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-[11.5px] keep-all leading-relaxed text-ink-muted">
            {report.finalObservation.unknown}
          </p>
          <p className="text-[12px] keep-all font-medium text-brand-pressed">
            {report.finalObservation.nextTip}
          </p>
        </section>
      ) : null}

      {report.limitations.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionLabel>이 리포트의 한계</SectionLabel>
          <ul className="flex flex-col gap-1.5">
            {report.limitations.map((item) => (
              <li key={item} className="flex gap-2 text-[12px] keep-all leading-relaxed text-ink-sub">
                <span className="flex-none text-ink-faint" aria-hidden>
                  ·
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* v1.10 §48 — 여기가 '리포트를 다 봤다'의 정의다(explicit CTA, viewport 노출 아님). */}
      <Button variant="secondary" onClick={handleReportComplete} disabled={completed}>
        {completed ? '확인 완료' : '다 봤어'}
      </Button>

      {/*
        v1.19 §12 — 평가는 **리포트를 다 본 뒤에만** 나타난다. 진입하자마자 설문을 띄우지
        않는다. 완독 CTA가 이미 이 IA의 자연스러운 완료 행동이라, 새 완료 조건(마지막 섹션
        viewport 진입 등)을 따로 만들지 않고 그 신호를 그대로 재사용한다.
        UT_MODE와 무관하게 보인다(§25) — Production 사용자에게도 필요한 질문이다.
      */}
      {completed ? (
        <DeepReportValueCheck
          analysisId={analysisId}
          price={price}
          properties={{ access_mode: accessMode, ...attribution }}
        />
      ) : null}

      {UT_MODE ? (
        <DeepReportUtFlow
          open={utOpen}
          onClose={() => setUtOpen(false)}
          analysisId={analysisId}
          properties={{ access_mode: accessMode, ...attribution }}
        />
      ) : null}
    </div>
  );
}
