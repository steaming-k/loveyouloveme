'use client';

import { useEffect, useRef } from 'react';

import { NoticeBox, SectionLabel } from '@/components/common/primitives';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { DeepInsightCard } from '@/components/premium/DeepInsightCard';
import { PremiumDetailView } from '@/components/premium/PremiumDetailView';
import type { EvidenceResolverContext } from '@/lib/aiEvidenceResolver';
import { trackEvent } from '@/lib/analytics';
import { axisLabel } from '@/services/premiumService';
import type { RelationshipDeepReport } from '@/types';

/**
 * Relationship Deep Report — "러비의 정밀 관찰 리포트" (v1.9 · §13~§23)
 *
 * 8개 섹션 순서를 그대로 지킨다: Overview → Relationship Self → Cross-source Insights →
 * Compatibility Deep Dive → Situations → Conversation Questions → History Deep →
 * Final Observation. 데이터가 없는 섹션은 만들어내지 않고 **숨긴다**(§42) — 그래서 이 파일은
 * 각 섹션을 조건부로만 렌더한다.
 */
export function RelationshipDeepReportView({
  report,
  resolverContext,
}: {
  report: RelationshipDeepReport;
  resolverContext: EvidenceResolverContext;
}) {
  const viewSent = useRef(false);

  useEffect(() => {
    if (viewSent.current) return;
    viewSent.current = true;
    trackEvent('deep_report_view', {
      insight_count: report.crossSourceInsights.length + report.relationshipSelf.length,
    });
  }, [report.crossSourceInsights.length, report.relationshipSelf.length]);

  if (!report.available) {
    return (
      <NoticeBox>
        {report.limitations[0] ?? '아직 연결해서 볼 수 있는 신호가 부족해.'}
      </NoticeBox>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 01 Overview */}
      <section className="flex flex-col gap-2">
        <h2 className="text-section keep-all font-semibold">{report.overview.headline}</h2>
        <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">
          {report.overview.subcopy}
        </p>
      </section>

      {/* 02 Relationship Self */}
      {report.relationshipSelf.length > 0 ? (
        <section className="flex flex-col gap-2.5">
          <SectionLabel>나의 관계 안에서</SectionLabel>
          <ul className="flex flex-col gap-2.5">
            {report.relationshipSelf.map((card) => (
              <DeepInsightCard key={card.insight.id} card={card} resolverContext={resolverContext} />
            ))}
          </ul>
        </section>
      ) : null}

      {/* 03 Cross-source Insights — Premium의 핵심 */}
      {report.crossSourceInsights.length > 0 ? (
        <section className="flex flex-col gap-2.5">
          <SectionLabel>따로 있던 걸 연결해보면</SectionLabel>
          <ul className="flex flex-col gap-2.5">
            {report.crossSourceInsights.map((card) => (
              <DeepInsightCard key={card.insight.id} card={card} resolverContext={resolverContext} />
            ))}
          </ul>
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
    </div>
  );
}
