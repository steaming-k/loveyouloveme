'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { BottomNavigation } from '@/components/common/BottomNavigation';
import { Button } from '@/components/common/Button';
import { HydrationGate } from '@/components/common/HydrationGate';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { Lines, PageHeading, SectionLabel, Tag } from '@/components/common/primitives';
import { HistoryChangeRow } from '@/components/history/HistoryChangeRow';
import { RepeatedSignalNotice } from '@/components/history/PastObservationNote';
import { Lovy } from '@/components/lovy/Lovy';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { HISTORY_COPY, LOVY_LINES } from '@/data/copy';
import { trackEvent } from '@/lib/analytics';
import { formatEntryDate } from '@/lib/historyFormat';
import { ROUTES } from '@/lib/routes';
import { useHistoryReport, useRepeatedSignals } from '@/hooks/useAnalysis';
import { useHistory } from '@/state/HistoryProvider';

/**
 * F1 Relationship History — 실제 기능 (v1.3에서 정적 mock 제거)
 *
 * 시각적 우선순위(§11): ① 현재 Insight ② 의미 있는 변화 ③ 과거 관찰 ④ Timeline
 * Dashboard·Chart·CRM·Calendar·Diary처럼 만들지 않는다. Editorial Personal Archive다.
 *
 * Timeline은 상대 중심이 아니라 **Insight 중심**이고, 항목은 분석 시점(날짜)으로만 구분한다 —
 * 상대 이름·연애 기간·'몇 번째 연애'는 쓰지 않는다.
 */
export default function HistoryPage() {
  return (
    <HydrationGate>
      <HistoryView />
    </HydrationGate>
  );
}

function HistoryView() {
  const router = useRouter();
  const { entries, latest } = useHistory();
  const report = useHistoryReport();
  const repeated = useRepeatedSignals();

  useEffect(() => {
    trackEvent('relationship_history_view', { entry_count: entries.length });
  }, [entries.length]);

  if (entries.length === 0) {
    return (
      <ScreenLayout
        header={<ScreenHeader backHref={ROUTES.home} title="관찰 기록" />}
        footer={<Button onClick={() => router.push(ROUTES.profileIntro)}>{HISTORY_COPY.empty.cta}</Button>}
        nav={<BottomNavigation />}
      >
        <div className="flex h-full flex-col items-center justify-center gap-4 px-3.5 pb-10 text-center">
          <Lovy pose="calendar" size={120} decorative />
          <h2 className="text-section keep-all">
            {HISTORY_COPY.empty.title.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h2>
          <p className="text-sub keep-all leading-relaxed text-ink-sub">
            {HISTORY_COPY.empty.body}
          </p>
        </div>
      </ScreenLayout>
    );
  }

  const latestInsight =
    latest?.coreInsight.userCorrection?.trim() || latest?.coreInsight.original || '';

  return (
    <ScreenLayout
      header={
        <ScreenHeader
          backHref={ROUTES.home}
          action={<Tag tone="brand">{HISTORY_COPY.badge}</Tag>}
        />
      }
      footer={
        report.comparable ? (
          <Button onClick={() => router.push(ROUTES.historyReport)}>변화 리포트 보기</Button>
        ) : (
          <Button variant="secondary" onClick={() => router.push(ROUTES.home)}>
            홈으로
          </Button>
        )
      }
      nav={<BottomNavigation />}
      bodyClassName="pt-1.5 pb-4"
    >
      <div className="flex flex-col gap-5">
        <PageHeading lines={HISTORY_COPY.title} caption={HISTORY_COPY.caption} />

        {/* ① 현재 Insight */}
        {latestInsight ? (
          <section className="flex flex-col gap-2.5 rounded-card bg-brand-tint px-[18px] py-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10.5px] font-semibold tracking-[0.1em] text-brand-pressed">
                {HISTORY_COPY.nowLabel} · 가장 최근 관찰
              </p>
              <span className="flex-none text-[11px] tnum text-brand-pressed">
                {formatEntryDate(latest!.createdAt)}
              </span>
            </div>
            <p className="text-[18px] font-semibold leading-[1.5] tracking-[-0.4px] keep-all text-brand-ink">
              {latestInsight}
            </p>
          </section>
        ) : null}

        {/* ② 의미 있는 변화 — 기록 1개면 가짜 변화를 만들지 않는다 */}
        <section className="flex flex-col gap-2.5">
          <SectionLabel>변화 요약</SectionLabel>
          {/*
            §15-② — 기록이 1개일 때의 문장은 승인된 줄바꿈을 그대로 지킨다. 텍스트 내용은
            `buildHistoryReport`의 summary와 동일하고(같은 문장), 판정 로직은 건드리지 않았다.
          */}
          <p className="px-1 text-caption keep-all leading-relaxed text-ink-sub">
            {!report.comparable && report.entryCount === 1 ? (
              <Lines lines={HISTORY_COPY.reportSingle} />
            ) : (
              report.summary
            )}
          </p>

          {report.comparable ? (
            <ul className="flex flex-col gap-2.5">
              {report.changes
                .filter((change) => change.state === 'SHIFT' || change.state === 'NEW')
                .slice(0, 3)
                .map((change) => (
                  <HistoryChangeRow key={change.axis} change={change} />
                ))}
            </ul>
          ) : null}
        </section>

        {/* ③ 과거 관찰 — 반복 신호 */}
        {repeated.length > 0 ? <RepeatedSignalNotice signals={repeated} /> : null}

        {/* ④ Timeline — Insight 중심, 날짜로만 구분 */}
        <section className="flex flex-col gap-2.5">
          <SectionLabel>관찰 기록</SectionLabel>
          <ol className="relative flex flex-col pl-[22px]">
            <span className="absolute top-2 bottom-3.5 left-[5px] w-px bg-rule" aria-hidden />

            {[...entries].reverse().map((entry) => {
              const insight =
                entry.coreInsight.userCorrection?.trim() || entry.coreInsight.original;

              return (
                <li key={entry.id} className="relative pb-[18px] last:pb-0">
                  <span
                    className="absolute top-[7px] -left-[22px] h-[11px] w-[11px] rounded-full bg-brand"
                    aria-hidden
                  />
                  <button
                    type="button"
                    onClick={() => router.push(ROUTES.historyEntry(entry.id))}
                    className="flex w-full flex-col gap-1.5 rounded-row border border-line bg-surface p-3.5 text-left active:bg-sunken"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] tnum text-ink-muted">
                        {formatEntryDate(entry.createdAt)} · Relationship Mirror
                      </span>
                      <span className="flex-none text-[13px] text-ink-faint" aria-hidden>
                        →
                      </span>
                    </div>
                    <p className="text-caption keep-all leading-relaxed">
                      {insight || '핵심 관찰 문장이 없어'}
                    </p>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        <LovyMessage pose="calendar" size={60}>
          <Lines lines={LOVY_LINES.historyReport} />
        </LovyMessage>
      </div>
    </ScreenLayout>
  );
}
