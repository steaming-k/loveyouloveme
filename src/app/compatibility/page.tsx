'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/common/Button';
import { HydrationGate } from '@/components/common/HydrationGate';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { SyncScore } from '@/components/compatibility/SyncScore';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { COMPATIBILITY_COPY, LOVY_LINES, STATE_COPY } from '@/data/copy';
import { trackEvent, trackOnce } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { lensAvailability } from '@/lib/logic/birth';
import { ROUTES } from '@/lib/routes';
import { useCompatibility, useMbtiLens } from '@/hooks/useAnalysis';
import { useSession } from '@/state/SessionProvider';

/**
 * S21 Compatibility Hero
 * 숫자는 Hook일 뿐이다. 화면에서 가장 강한 자리에 있지만, 바로 아래에
 * '왜 이렇게 나왔는지'로 넘어가는 길을 가장 눈에 띄게 둔다.
 *
 * 비교 가능한 항목이 부족하면(E3) 점수를 억지로 만들지 않고 '?'로 둔다.
 */
export default function CompatibilityPage() {
  return (
    <HydrationGate>
      <CompatibilityView />
    </HydrationGate>
  );
}

function CompatibilityView() {
  const router = useRouter();
  const result = useCompatibility();
  const mbtiLens = useMbtiLens();
  const { answers } = useSession();
  const [today] = useState(() => new Date());
  // 두 사람 출생정보가 모두 있을 때만 '다른 렌즈' 진입점을 보여준다.
  const entertainmentReady = lensAvailability(
    answers.birthProfile,
    answers.target.birthProfile,
    today,
  ).couple;

  useEffect(() => {
    if (result.score === null) return;
    // Primary KPI 분모 — 궁합 결과를 본 사용자 수. 세션당 한 번만 센다.
    trackOnce('compatibility_result_view', { score: result.score, compared: result.comparedCount });
  }, [result.score, result.comparedCount]);

  useEffect(() => {
    if (!mbtiLens) return;
    // Supporting 지표 분모 — MBTI 입력률(both_mbti_available / compatibility_result_view)
    trackOnce('both_mbti_available', { self: mbtiLens.mine, target: mbtiLens.theirs });
  }, [mbtiLens]);

  if (result.score === null) {
    return <LowConfidenceView />;
  }

  return (
    <ScreenLayout
      header={
        <ScreenHeader
          backHref={ROUTES.target}
          action={
            <button
              type="button"
              onClick={() => router.push(ROUTES.shareCompatibility)}
              className="flex h-11 items-center px-1 text-caption text-ink-sub"
            >
              공유
            </button>
          }
        />
      }
      footer={
        <div className="flex flex-col gap-2">
          <Button
            onClick={() => {
              trackEvent('compatibility_reason_view', { score: result.score ?? 0 });
              router.push(ROUTES.compatibilityWhy);
            }}
          >
            왜 {result.score}인지 보기
          </Button>
          <Button variant="secondary" onClick={() => router.push(ROUTES.shareCompatibility)}>
            결과 공유
          </Button>
        </div>
      }
      bodyClassName="pt-0 pb-4"
    >
      <div className="flex flex-col gap-[18px]">
        <SyncScore score={result.score} />

        <p className="px-1 text-center text-meta text-ink-muted">
          비교 가능한 {result.comparedCount}개 관계 신호 기준
        </p>

        {/* MBTI는 점수에 들어가지 않는다. '렌즈가 있다'는 사실만 작게 알리고 상세로 넘긴다.
            한쪽이라도 MBTI가 없으면 이 Tag 자체를 숨긴다.
            사주·Astrology는 여기서 각각 뱃지를 달지 않는다 — 점수 주변을 뱃지 천지로 만들지
            않기 위해, 준비된 게 있으면 '다른 렌즈 N개' 한 줄로만 묶어 허브로 보낸다. */}
        {mbtiLens ? (
          <button
            type="button"
            onClick={() => router.push(ROUTES.lensMbti)}
            className="mx-auto flex min-h-11 items-center gap-1.5 rounded-tag border border-line bg-surface px-3 py-2 text-[12px] text-ink-sub active:bg-sunken"
          >
            <span className="font-medium text-ink">
              {mbtiLens.mine} × {mbtiLens.theirs}
            </span>
            <span className="text-ink-faint">·</span>
            <span>MBTI 렌즈 있음</span>
            <span className="text-ink-faint" aria-hidden>
              →
            </span>
          </button>
        ) : null}

        {entertainmentReady ? (
          <button
            type="button"
            onClick={() => router.push(ROUTES.compatibilityLenses)}
            className="mx-auto flex min-h-11 items-center gap-1.5 text-[12px] text-ink-muted"
          >
            다른 궁합 렌즈 2개 보기
            <span className="text-ink-faint" aria-hidden>
              →
            </span>
          </button>
        ) : null}

        <div className="flex gap-2">
          <SummaryCard
            value={result.goodSignals.length}
            label={COMPATIBILITY_COPY.goodCountLabel}
          />
          <SummaryCard
            value={result.frictionSignals.length}
            label={COMPATIBILITY_COPY.watchCountLabel}
            tone="watch"
          />
        </div>

        {result.unknownLabels.length > 0 ? (
          <p className="px-1 text-meta text-ink-muted">
            모름으로 남긴 {result.unknownLabels.length}개 항목은 계산에서 빼뒀어 ·{' '}
            {result.unknownLabels.join(' · ')}
          </p>
        ) : null}

        <LovyMessage pose="chart" size={46}>
          {LOVY_LINES.compatibilityHero}
        </LovyMessage>
      </div>
    </ScreenLayout>
  );
}

function SummaryCard({
  value,
  label,
  tone = 'good',
}: {
  value: number;
  label: string;
  tone?: 'good' | 'watch';
}) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-row border border-line bg-surface px-4 py-3.5">
      <p
        className={cn(
          'text-[26px] font-semibold tracking-[-0.8px] tnum',
          tone === 'watch' ? 'text-friction-text' : 'text-ink',
        )}
      >
        {value}
      </p>
      <p className="text-[12.5px] text-ink-sub">{label}</p>
    </div>
  );
}

/** E3 상대 정보 부족 · 관측 정보 부족 */
function LowConfidenceView() {
  const router = useRouter();
  const result = useCompatibility();

  useEffect(() => {
    // 확신 낮은 결과도 '궁합 결과를 본 것'은 맞다 — Primary KPI 분모에서 빠지면 안 된다.
    trackOnce('compatibility_result_view', { score: 0, compared: result.comparedCount });
  }, [result.comparedCount]);

  return (
    <ScreenLayout
      header={<ScreenHeader backHref={ROUTES.target} title="궁합 결과" />}
      footer={
        <div className="flex flex-col gap-0.5">
          <Button onClick={() => router.push(ROUTES.target)}>아는 것만 더 알려주기</Button>
          <Button variant="text" onClick={() => router.push(ROUTES.mirrorTeaser)}>
            그래도 내 분석은 볼래
          </Button>
        </div>
      }
      bodyClassName="pt-2 pb-4"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-1.5 pt-3.5 pb-1">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-muted">
            {COMPATIBILITY_COPY.scoreLabel}
          </p>
          <p className="text-[74px] font-semibold leading-none tracking-[-3px] text-ink-faint">?</p>
          <p className="mt-1.5 rounded-[7px] bg-friction-tint px-2.5 py-1.5 text-[11px] font-semibold text-friction-text">
            관측 정보 부족 · 입력 {result.comparedCount}/{result.totalCount}
          </p>
        </div>

        <LovyMessage pose={STATE_COPY.lowConfidence.pose} size={70} tone="lead">
          {STATE_COPY.lowConfidence.message}
        </LovyMessage>

        <div className="flex flex-col gap-3 rounded-[16px] border border-line bg-surface p-4">
          <h2 className="text-caption font-semibold">비교하지 못한 항목</h2>
          <ul className="flex flex-wrap gap-1.5">
            {result.unknownLabels.map((label) => (
              <li
                key={label}
                className="rounded-tag border border-dashed border-line-strong bg-sunken px-2.5 py-1.5 text-[12.5px] text-ink-muted"
              >
                {label}
              </li>
            ))}
          </ul>
          <p className="text-[12.5px] leading-relaxed keep-all text-ink-sub">
            {Math.max(1, 3 - result.comparedCount)}개 이상 더 알려주면 동기화율을 계산할 수 있어요.
          </p>
        </div>
      </div>
    </ScreenLayout>
  );
}
