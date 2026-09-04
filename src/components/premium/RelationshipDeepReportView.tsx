'use client';

import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/common/Button';
import { NoticeBox, SectionLabel } from '@/components/common/primitives';
import { AiNarrativeNotice, AiSourceLabel } from '@/components/ai/AiModeNotice';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { DeepInsightCard } from '@/components/premium/DeepInsightCard';
import { PremiumDetailView } from '@/components/premium/PremiumDetailView';
import { DeepReportUtFlow } from '@/components/ut/DeepReportUtFlow';
import type { EvidenceResolverContext } from '@/lib/aiEvidenceResolver';
import { trackEvent } from '@/lib/analytics';
import { UT_MODE } from '@/lib/env';
import { hasCompletedDeepReportUt } from '@/lib/deepReportUtStore';
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
  accessMode = 'preview',
  aiNarrative,
}: {
  report: RelationshipDeepReport;
  resolverContext: EvidenceResolverContext;
  analysisId: string;
  /** v1.10 §72 — 실제 Payment로 오해되지 않도록 어느 경로로 이 화면에 왔는지 남긴다 */
  accessMode?: 'preview' | 'beta_ut';
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

  useEffect(() => {
    setCompleted(hasCompletedDeepReportUt(analysisId));
  }, [analysisId]);

  useEffect(() => {
    if (viewSent.current) return;
    viewSent.current = true;
    trackEvent('deep_report_view', {
      analysis_id: analysisId,
      access_mode: accessMode,
      insight_count: report.crossSourceInsights.length + report.relationshipSelf.length,
    });
  }, [report.crossSourceInsights.length, report.relationshipSelf.length, analysisId, accessMode]);

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
        trackEvent('deep_report_scroll', { analysis_id: analysisId, depth: 100 });
      } else if (percent >= 50 && !scrollDepthSent.current[50]) {
        scrollDepthSent.current[50] = true;
        trackEvent('deep_report_scroll', { analysis_id: analysisId, depth: 50 });
      }
    };

    scrollParent.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollParent?.removeEventListener('scroll', handleScroll);
  }, [analysisId]);

  if (!report.available) {
    return (
      <NoticeBox>
        {report.limitations[0] ?? '아직 연결해서 볼 수 있는 신호가 부족해.'}
      </NoticeBox>
    );
  }

  const handleReportComplete = () => {
    trackEvent('deep_report_complete', { analysis_id: analysisId, access_mode: accessMode });
    setCompleted(true);
    if (UT_MODE) setUtOpen(true);
  };

  return (
    <div ref={rootRef} className="flex flex-col gap-6">
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
              <DeepInsightCard key={card.insight.id} card={card} resolverContext={resolverContext} analysisId={analysisId} />
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
              <DeepInsightCard key={card.insight.id} card={card} resolverContext={resolverContext} analysisId={analysisId} />
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

      {UT_MODE ? (
        <DeepReportUtFlow
          open={utOpen}
          onClose={() => setUtOpen(false)}
          analysisId={analysisId}
          properties={{ access_mode: accessMode }}
        />
      ) : null}
    </div>
  );
}
