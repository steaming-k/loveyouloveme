'use client';

import { Button } from '@/components/common/Button';
import { HydrationGate } from '@/components/common/HydrationGate';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { PageHeading } from '@/components/common/primitives';
import { HistoryChangeRow } from '@/components/history/HistoryChangeRow';
import { Lovy } from '@/components/lovy/Lovy';
import { HISTORY_COPY } from '@/data/copy';
import { ROUTES } from '@/lib/routes';
import { useHistoryReport } from '@/hooks/useAnalysis';
import { useHistory } from '@/state/HistoryProvider';
import { useNavReplace } from '@/hooks/useContextualBack';

/**
 * F3 저장 직후 Change Moment (§8/§9)
 *
 * 첫 기록: 비교할 과거가 없다는 사실을 정직하게 말한다 — 가짜 변화 결과를 만들지 않는다.
 * 두 번째부터: 처음으로 실제 비교가 가능해진 순간이다. Relationship History의 첫 Retention
 * Aha Moment이므로, 의미 있는 변화 1개만 미리 보여주고 상세는 리포트로 넘긴다.
 */
export default function HistorySavedPage() {
  return (
    <HydrationGate>
      <HistorySavedView />
    </HydrationGate>
  );
}

function HistorySavedView() {
  const navReplace = useNavReplace();
  const { entries } = useHistory();
  const report = useHistoryReport();

  // 저장 없이 직접 URL로 들어온 경우
  if (entries.length === 0) {
    return (
      <ScreenLayout
        footer={<Button onClick={() => navReplace(ROUTES.home)}>홈으로</Button>}
      >
        <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
          <Lovy pose="question" size={110} decorative />
          <p className="text-sub keep-all text-ink-sub">아직 저장된 관찰이 없어.</p>
        </div>
      </ScreenLayout>
    );
  }

  const first = entries.length === 1;
  const headline = report.headline;

  return (
    <ScreenLayout
      footer={
        <div className="flex flex-col gap-2">
          {first ? (
            <>
              <Button onClick={() => navReplace(ROUTES.history)}>
                {HISTORY_COPY.saved.firstCta}
              </Button>
              <Button variant="secondary" onClick={() => navReplace(ROUTES.home)}>
                홈으로
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => navReplace(ROUTES.historyReport)}>
                {HISTORY_COPY.saved.againCta}
              </Button>
              <Button variant="text" onClick={() => navReplace(ROUTES.home)}>
                나중에
              </Button>
            </>
          )}
        </div>
      }
      centered
      bodyClassName="py-4"
    >
      <div className="flex flex-col items-center gap-5">
        <Lovy pose={first ? 'record' : 'calendar'} size={112} decorative />

        <PageHeading
          lines={first ? HISTORY_COPY.saved.firstTitle : HISTORY_COPY.saved.againTitle}
          caption={first ? HISTORY_COPY.saved.firstBody : HISTORY_COPY.saved.againBody}
          size="title"
          className="text-center"
        />

        {/* 두 번째 이후 — 가장 의미 있는 변화 1개만 미리보기. 없으면 억지로 만들지 않는다. */}
        {!first && headline ? (
          <ul className="w-full">
            <HistoryChangeRow change={headline} />
          </ul>
        ) : null}

        {!first && !headline ? (
          <p className="px-2 text-center text-caption keep-all leading-relaxed text-ink-sub">
            {report.summary}
          </p>
        ) : null}

        {/*
          v1.48.1 — **UT 종료 카드(`UtSummaryCard`)를 참가자 화면에서 뺐다.**
          `UT · 연구용 문항` 라벨 + 1~5 척도 두 개는 연구 계측이다. 두 문항
          (`ut_self_understanding_helpfulness` · `ut_photo_value_rate`)은 운영자
          화면(`/ut`)으로 옮겼다 — 진행자가 구두로 묻고 기록한다.
        */}
      </div>
    </ScreenLayout>
  );
}
