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
import { historyCountBucket, trackEvent } from '@/lib/analytics';
import { formatEntryDate } from '@/lib/historyFormat';
import { ROUTES } from '@/lib/routes';
import { useHistoryReport, useRepeatedSignals, useSoloHistoryReport, useSoloMode } from '@/hooks/useAnalysis';
import { useHistory } from '@/state/HistoryProvider';
import { filterHistoryByAudience, historyAudienceOf } from '@/lib/logic/soloHistory';
import { useSession } from '@/state/SessionProvider';
import type { RelationshipHistoryEntry } from '@/types';

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
  const { answers } = useSession();
  const { entries, latest } = useHistory();
  const report = useHistoryReport();
  const soloReport = useSoloHistoryReport();
  const repeated = useRepeatedSignals();
  const mode = useSoloMode();

  /**
   * 이 Archive에 어떤 관찰이 들어 있는가 (v1.35 · §10).
   *
   * ⚠️ **탭으로 나누지 않는다.** 하나의 timeline을 유지하고, 화면이 스스로 어떤 관찰을
   * 몇 건 갖고 있는지만 작은 metadata로 말한다. 나누는 순간 '관계 기록'과 '내 기록'이
   * 서로 다른 제품처럼 읽히는데, 둘 다 같은 질문("내 기준이 어떻게 움직였나")의 기록이다.
   */
  const soloCount = filterHistoryByAudience(entries, 'solo').length;
  const coupleCount = entries.length - soloCount;

  useEffect(() => {
    trackEvent('relationship_history_view', {
      entry_count: entries.length,
      // §26 — bucket을 함께 보낸다. 개수 그대로만 보면 구간별 행동 차이를 볼 수 없다.
      history_bucket: historyCountBucket(entries.length),
      /** §25 — audience 구성은 categorical 하나로만. 어떤 기록인지는 보내지 않는다 */
      audience_mix:
        entries.length === 0
          ? 'none'
          : soloCount > 0 && coupleCount > 0
            ? 'mixed'
            : soloCount > 0
              ? 'solo'
              : 'couple',
    });
  }, [entries.length, soloCount, coupleCount]);

  if (entries.length === 0) {
    /**
     * §30 — **갈 수 없는 길을 알려주지 않는다.**
     *
     * 예전 빈 화면은 누구에게나 "첫 Relationship Mirror를 저장하면"이라고 말하고
     * 프로필 입력으로 보냈다. 상대도 관계 경험도 없는 사용자에게 Mirror는 애초에
     * 만들어지지 않는다 — 그 사용자가 남길 수 있는 첫 기록은 First Contact 관찰이다.
     */
    const soloEmpty = mode !== 'couple' && answers.completed.profile;
    return (
      <ScreenLayout
        header={<ScreenHeader backHref={ROUTES.home} title="관찰 기록" />}
        footer={
          soloEmpty ? (
            <Button onClick={() => router.push(ROUTES.firstContact)}>
              {HISTORY_COPY.empty.soloCta}
            </Button>
          ) : (
            <Button onClick={() => router.push(ROUTES.profileIntro)}>
              {HISTORY_COPY.empty.cta}
            </Button>
          )
        }
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
            {soloEmpty ? HISTORY_COPY.empty.soloBody : HISTORY_COPY.empty.body}
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
      /*
        ⚠️ v1.35 §10 — **Solo 사용자를 '홈으로'로 내보내지 않는다.**
        예전에는 커플 변화 리포트를 만들 수 없으면(= Solo 기록만 있으면) 무조건
        '홈으로' 버튼이었다. Solo의 시간축 비교는 `/first-contact`의 WHAT CHANGED가
        담당하므로, 갈 곳이 있는데 없는 것처럼 보이지 않게 그쪽으로 보낸다.
      */
      footer={
        report.comparable ? (
          <Button onClick={() => router.push(ROUTES.historyReport)}>변화 리포트 보기</Button>
        ) : soloReport.comparable ? (
          <Button onClick={() => router.push(ROUTES.firstContact)}>
            지금 답과 비교해보기
          </Button>
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

        {/*
          ② 의미 있는 변화 — 기록 1개면 가짜 변화를 만들지 않는다.

          ⚠️ v1.35 §10 — **커플 요약을 Solo 기록에 적용하지 않는다.**
          `report`는 커플 기록만 보므로, Solo 관찰만 2건 저장한 사용자에게 예전 화면은
          아래 timeline에 기록 2건을 보여주면서 이 자리에는 "아직 저장된 관찰이 없어"를
          띄웠다(실측). 그래서 커플 요약은 **커플 기록이 있을 때만** 그리고, Solo 요약은
          별도 줄로 둔다 — 두 요약의 주어가 다르므로 한 문장으로 합치지 않는다.
        */}
        <section className="flex flex-col gap-2.5">
          <SectionLabel>변화 요약</SectionLabel>

          {coupleCount > 0 ? (
            <p className="px-1 text-caption keep-all leading-relaxed text-ink-sub">
              {/*
                §15-② — 기록이 1개일 때의 문장은 승인된 줄바꿈을 그대로 지킨다. 텍스트 내용은
                `buildHistoryReport`의 summary와 동일하고(같은 문장), 판정 로직은 건드리지 않았다.
              */}
              {!report.comparable && report.entryCount === 1 ? (
                <Lines lines={HISTORY_COPY.reportSingle} />
              ) : (
                report.summary
              )}
            </p>
          ) : null}

          {/*
            Solo 요약 — 저장된 snapshot과 **지금 답** 사이의 비교다(§17: 이 비교는 무료다).
            ⚠️ 여기서 다시 계산하지 않는다. `useSoloHistoryReport()`의 결과 문장을 그대로 쓴다.
          */}
          {soloCount > 0 ? (
            <p className="px-1 text-caption keep-all leading-relaxed text-ink-sub">
              {soloReport.comparable && soloReport.headline
                ? `내 관찰 ${soloCount}건 · ${soloReport.headline}`
                : `내 관찰 ${soloCount}건을 남겨뒀어. 생각이 조금 달라졌다면 다시 관찰해볼까?`}
            </p>
          ) : null}

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
                        {formatEntryDate(entry.createdAt)} · {historyKindLabel(entry)}
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


/**
 * 이 기록이 어떤 관찰인지 (v1.34 P4-B).
 *
 * ⚠️ 예전에는 모든 항목에 `Relationship Mirror`가 붙었다. Solo 관찰에는 그게 **거짓**이다 —
 * 상대도 Mirror 판정도 없는 기록에 관계 분석 이름을 붙이지 않는다.
 *
 * 탭을 나누지 않고 **같은 timeline 안에서 metadata로만** 구분한다(§23).
 */
function historyKindLabel(entry: RelationshipHistoryEntry): string {
  return historyAudienceOf(entry) === 'solo' ? '나의 관찰' : 'Relationship Mirror';
}