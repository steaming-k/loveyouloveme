'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/common/Button';
import { HydrationGate } from '@/components/common/HydrationGate';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { PageHeading, SectionLabel, Tag } from '@/components/common/primitives';
import { HistoryChangeRow } from '@/components/history/HistoryChangeRow';
import { RepeatedSignalNotice } from '@/components/history/PastObservationNote';
import { PremiumEntryRow } from '@/components/premium/PremiumEntryRow';
import { Lovy } from '@/components/lovy/Lovy';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { HISTORY_COPY, LOVY_LINES } from '@/data/copy';
import { trackEvent } from '@/lib/analytics';
import { resolvePrice, resolvePriceVariant } from '@/lib/premiumVariant';
import { premiumFeatureState } from '@/services/premiumService';
import { formatEntryDate } from '@/lib/historyFormat';
import { ROUTES } from '@/lib/routes';
import { useHistoryReport, useRepeatedSignals } from '@/hooks/useAnalysis';
import { useHistory } from '@/state/HistoryProvider';

/**
 * F2 변화 리포트 — 실제 데이터 기반 (v1.3에서 정적 mock 제거)
 *
 * 기록이 2개 미만이면 변화를 판정하지 않는다 — 가짜 변화 결과를 만들지 않는다(§26).
 * '성장했다 / 좋아졌다'는 판정을 어디에도 만들지 않는다.
 */
export default function HistoryReportPage() {
  return (
    <HydrationGate>
      <HistoryReportView />
    </HydrationGate>
  );
}

function HistoryReportView() {
  const router = useRouter();
  const { entries, previous, latest } = useHistory();
  const report = useHistoryReport();
  const repeated = useRepeatedSignals();
  const [variant] = useState(() => resolvePriceVariant());

  useEffect(() => {
    trackEvent('relationship_history_change_report_view', {
      entry_count: report.entryCount,
      change_count: report.shiftCount + report.newCount,
    });
  }, [report.entryCount, report.shiftCount, report.newCount]);

  useEffect(() => {
    for (const signal of repeated) {
      trackEvent('relationship_history_repeated_signal_view', {
        axis: signal.axis,
        occurrences: signal.occurrences,
      });
    }
  }, [repeated]);

  // 비교 불가 — 기록 0~1개
  if (!report.comparable) {
    return (
      <ScreenLayout
        header={<ScreenHeader backHref={ROUTES.history} title="변화 리포트" />}
        footer={
          <Button onClick={() => router.push(entries.length === 0 ? ROUTES.home : ROUTES.history)}>
            {entries.length === 0 ? '홈으로' : '내 기록 보기'}
          </Button>
        }
      >
        <div className="flex h-full flex-col items-center justify-center gap-4 px-3.5 pb-10 text-center">
          <Lovy pose="mug" size={112} decorative />
          <h2 className="text-section keep-all">아직 비교할 기록이 부족해.</h2>
          <p className="text-sub keep-all leading-relaxed text-ink-sub">
            {entries.length === 1 ? HISTORY_COPY.reportSingle : '아직 저장된 관찰이 없어.'}
          </p>
        </div>
      </ScreenLayout>
    );
  }

  // 같은 날 저장한 두 관찰이면 날짜를 두 번 적어도 구분이 안 된다 — 그때는 순서로만 말한다.
  const comparedCaption = (() => {
    if (!previous || !latest) return undefined;
    const past = formatEntryDate(previous.createdAt);
    const now = formatEntryDate(latest.createdAt);
    return past === now
      ? `${now}에 저장한 두 관찰을 비교했어.`
      : `${past} 관찰과 ${now} 관찰을 비교했어.`;
  })();

  const stable = report.changes.filter((change) => change.state === 'STABLE');
  const fresh = report.changes.filter((change) => change.state === 'NEW');
  const shifted = report.changes.filter((change) => change.state === 'SHIFT');
  const insufficient = report.changes.filter((change) => change.state === 'INSUFFICIENT');

  return (
    <ScreenLayout
      header={
        <ScreenHeader backHref={ROUTES.history} action={<Tag tone="brand">CHANGE REPORT</Tag>} />
      }
      footer={
        <Button variant="secondary" onClick={() => router.push(ROUTES.history)}>
          내 기록 보기
        </Button>
      }
      bodyClassName="pt-1.5 pb-6"
    >
      <div className="flex flex-col gap-5">
        <PageHeading lines={HISTORY_COPY.reportTitle} caption={comparedCaption} />

        <p className="rounded-chip bg-sunken px-3.5 py-3 text-caption keep-all leading-relaxed text-ink-sub">
          {report.summary}
        </p>

        {/* 가장 큰 변화 1개 */}
        {report.headline ? (
          <section className="flex flex-col gap-2.5">
            <SectionLabel>가장 큰 변화</SectionLabel>
            <ul>
              <HistoryChangeRow change={report.headline} />
            </ul>
          </section>
        ) : null}

        {/* 그 외 변화 */}
        {shifted.filter((change) => change.axis !== report.headline?.axis).length > 0 ? (
          <section className="flex flex-col gap-2.5">
            <SectionLabel>달라진 기준</SectionLabel>
            <ul className="flex flex-col gap-2.5">
              {shifted
                .filter((change) => change.axis !== report.headline?.axis)
                .map((change) => (
                  <HistoryChangeRow key={change.axis} change={change} />
                ))}
            </ul>
          </section>
        ) : null}

        {/* 새롭게 등장한 신호 */}
        {fresh.filter((change) => change.axis !== report.headline?.axis).length > 0 ? (
          <section className="flex flex-col gap-2.5">
            <SectionLabel>새롭게 보인 신호</SectionLabel>
            <ul className="flex flex-col gap-2.5">
              {fresh
                .filter((change) => change.axis !== report.headline?.axis)
                .map((change) => (
                  <HistoryChangeRow key={change.axis} change={change} />
                ))}
            </ul>
          </section>
        ) : null}

        {/* 유지된 기준 */}
        {stable.length > 0 ? (
          <section className="flex flex-col gap-2.5">
            <SectionLabel>유지된 기준</SectionLabel>
            <ul className="flex flex-col gap-2.5">
              {stable.map((change) => (
                <HistoryChangeRow key={change.axis} change={change} />
              ))}
            </ul>
          </section>
        ) : null}

        {/* 반복 신호 */}
        {repeated.length > 0 ? <RepeatedSignalNotice signals={repeated} /> : null}

        {/* 판정하지 않은 축 — 정보 부족을 숨기지 않는다 */}
        {insufficient.length > 0 ? (
          <section className="flex flex-col gap-2">
            <SectionLabel>아직 비교하기 어려운 기준</SectionLabel>
            <ul className="flex flex-wrap gap-1.5">
              {insufficient.map((change) => (
                <li
                  key={change.axis}
                  className="rounded-tag border border-dashed border-line-strong bg-sunken px-2.5 py-1.5 text-[12px] text-ink-muted"
                >
                  {change.label}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* 사용자 본인의 기록·타임라인·기본 비교는 전부 무료다. Premium은 해석의 깊이만(§34) */}
        <PremiumEntryRow
          feature={premiumFeatureState('history_detail', resolvePrice(variant), {
            historyComparable: report.comparable,
          })}
        />

        <LovyMessage pose="calendar" size={66}>
          {LOVY_LINES.historyReport}
        </LovyMessage>
      </div>
    </ScreenLayout>
  );
}
