'use client';

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/common/Button';
import { cn } from '@/lib/cn';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { UtRatingCard } from '@/components/ut/UtRatingCard';
import { usePremiumAccess, useUtMode } from '@/hooks/useUtMode';
import { AI_DEBUG, AI_MODE_HINT } from '@/lib/env';
import { trackEvent } from '@/lib/analytics';
import type { AnalyticsEvent, AnalyticsProperties } from '@/lib/analytics';
import { resolvePremiumAccess } from '@/lib/premiumAccess';
import { formatPrice, resolvePrice, resolvePriceVariant } from '@/lib/premiumVariant';
import { ROUTES } from '@/lib/routes';
import { downloadUtExport } from '@/lib/utExport';
import { UT_REQUIRED_ROUTES, evaluateUtHealth, type UtHealthItem } from '@/lib/utHealth';
import { UT_MODE_DEPLOYMENT } from '@/lib/utMode';
import { clearParticipantStorage } from '@/lib/utReset';
import { useSession } from '@/state/SessionProvider';

const SESSION_KEY = 'lym.session.v1';

function sessionParsable(): boolean {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (raw) JSON.parse(raw);
    return true;
  } catch {
    return false;
  }
}

const MARK: Record<UtHealthItem['status'], string> = { pass: '✓', warn: '!', fail: '✗' };

/**
 * 진행자가 묻는 문항 — **참가자 화면에서 회수한 것들**이다 (v1.48.1).
 *
 * 각 항목의 `event`는 참가자 화면에 있던 것과 **같은 이름**이다. 화면에서 뺐다고
 * 지표를 끊지 않는다.
 *
 * `when`은 진행자가 언제 물어야 하는지다 — 참가자가 그 화면을 지난 직후다.
 */
const INTERVIEW_MOMENTS: readonly {
  when: string;
  scales: readonly {
    question: string;
    event: AnalyticsEvent;
    properties?: AnalyticsProperties;
    lowLabel: string;
    highLabel: string;
    /** 사진 입력 여부·장수를 함께 보낼 문항(사진 가치 A/B 분리용) */
    withPhotoContext?: boolean;
  }[];
  choices?: readonly {
    question: (price: number) => string;
    event: AnalyticsEvent;
    properties?: AnalyticsProperties;
    options: readonly { value: string; label: string }[];
  }[];
}[] = [
  {
    when: 'S09 사진 관찰 뒤',
    scales: [
      {
        question: '사진 관찰 결과가 평소의 나와 얼마나 비슷했어?',
        event: 'ut_analysis_similarity_rate',
        properties: { task: 'observed' },
        lowLabel: '전혀 다름',
        highLabel: '매우 비슷함',
      },
    ],
  },
  {
    when: 'Relationship Mirror 뒤',
    scales: [
      {
        question: '왜 이런 결과가 나왔는지 근거가 이해됐어?',
        event: 'ut_evidence_clarity_rate',
        properties: { task: 'relationship' },
        lowLabel: '전혀 모르겠어',
        highLabel: '충분히 이해됐어',
      },
    ],
  },
  {
    when: 'Premium Paywall 뒤',
    scales: [
      {
        question: '이 리포트에서 무료 결과와 다른 가치를 느꼈어?',
        event: 'ut_premium_value_diff_rate',
        lowLabel: '전혀 못 느꼈어',
        highLabel: '확실히 다르게 느꼈어',
      },
    ],
    choices: [
      {
        question: (price) => `${formatPrice(price)}을 내고 전체 리포트를 볼 의향이 있어?`,
        event: 'ut_premium_price_wtp',
        options: [
          { value: 'yes', label: '실제로 결제할 의향이 있다' },
          { value: 'maybe', label: '결과를 더 봐야 판단할 수 있다' },
          { value: 'no', label: '무료 결과로 충분하다' },
        ],
      },
    ],
  },
  {
    when: 'Deep Report 완독 뒤',
    scales: [
      {
        question: '이 결과에서 새롭게 알게 된 내용이 있었어?',
        event: 'ut_new_insight_rate',
        lowLabel: '전혀 없었어',
        highLabel: '많이 있었어',
      },
      {
        question: '이 결과가 누구에게나 해당되는 뻔한 얘기처럼 느껴졌어?',
        event: 'ut_genericness_rate',
        lowLabel: '전혀 아니야',
        highLabel: '많이 그래',
      },
      {
        question: '따로 답한 것들을 연결해서 보여준 게 가치 있었어?',
        event: 'ut_cross_source_value_rate',
        lowLabel: '전혀 아니야',
        highLabel: '많이 그래',
      },
      {
        question: '무료 결과에 비해 추가로 얻은 게 있었어?',
        event: 'deep_report_value_rating',
        lowLabel: '전혀 없었어',
        highLabel: '확실히 있었어',
      },
    ],
    choices: [
      {
        question: (price) => `리포트를 본 뒤에 ${formatPrice(price)}을 낼 의향이 있어?`,
        event: 'deep_report_wtp_after_view',
        options: [
          { value: 'yes', label: '결제할 의향이 있어' },
          { value: 'maybe', label: '결과를 조금 더 봐야 판단할 수 있어' },
          { value: 'no', label: '무료 결과로 충분해' },
        ],
      },
      {
        question: () => '리포트를 본 뒤 결제 의향이 있어? (전체 리포트 열람 기준)',
        event: 'ut_deep_report_wtp',
        options: [
          { value: 'yes', label: '결제할 의향이 있어' },
          { value: 'maybe', label: '더 봐야 판단할 수 있어' },
          { value: 'no', label: '무료로 충분해' },
        ],
      },
    ],
  },
  {
    when: '관찰 기록 저장 뒤',
    scales: [
      {
        question: '이 결과가 연애할 때의 나를 이해하는 데 도움이 됐어?',
        event: 'ut_self_understanding_helpfulness',
        properties: { task: 'relationship' },
        lowLabel: '전혀 아니야',
        highLabel: '많이 도움됐어',
      },
      {
        question: '사진을 넣은 게 분석이 더 나답게 느껴지는 데 도움이 됐어?',
        event: 'ut_photo_value_rate',
        properties: { task: 'observed' },
        lowLabel: '전혀 아니야',
        highLabel: '많이 도움됐어',
        withPhotoContext: true,
      },
    ],
  },
];

/**
 * 선택형 문항 — 척도가 아니라 3지선다다(`UtRatingCard`와 같은 lock-after-answer).
 *
 * ⚠️ 운영자 화면 전용이다. 참가자 화면에는 이 형태의 설문을 두지 않는다.
 */
function UtChoiceCard({
  question,
  event,
  options,
  properties,
}: {
  question: string;
  event: AnalyticsEvent;
  options: readonly { value: string; label: string }[];
  properties?: AnalyticsProperties;
}) {
  const [choice, setChoice] = useState<string | null>(null);

  return (
    <section
      className="flex flex-col gap-2.5 rounded-card border border-dashed border-line-strong bg-sunken px-4 py-3.5"
      aria-label="사용성 테스트 문항"
    >
      <p className="text-caption keep-all leading-relaxed">{question}</p>
      <div className="flex flex-col gap-1.5" role="radiogroup" aria-label={question}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-checked={choice === option.value}
            role="radio"
            disabled={choice !== null}
            onClick={() => {
              trackEvent(event, { ...properties, choice: option.value });
              setChoice(option.value);
            }}
            className={cn(
              'min-h-11 rounded-[10px] border px-3.5 py-2.5 text-left text-caption disabled:opacity-60',
              choice === option.value
                ? 'border-brand bg-brand-tint font-semibold text-ink'
                : 'border-line bg-surface active:bg-sunken',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      {choice ? <p className="text-[11px] text-ink-faint">기록했어.</p> : null}
    </section>
  );
}

/**
 * UT 운영자 콘솔 (v1.47 UT-2 Stability) — `/ut`
 *
 * 10초 점검: 화면이 열리면 바로 필수 Route를 부르고 `evaluateUtHealth`로 READY/BLOCKED를 정한다.
 * 초기화: 이 브라우저의 럽유럽미 저장값(`lib/utReset.ts` 범위)을 지우고 **새로고침으로** 온보딩을 연다 —
 * 메모리에 남은 세션 · AI 캐시 · 진행 중 요청까지 함께 사라진다.
 */
export function UtOperatorConsole() {
  const utMode = useUtMode();
  const access = usePremiumAccess();
  const [routeStatus, setRouteStatus] = useState<Record<string, number> | null>(null);
  const [parsable, setParsable] = useState(true);
  const [resetOpen, setResetOpen] = useState(false);
  /** WTP 문항이 말하는 가격 — 참가자가 본 Paywall과 같은 세션 고정 값을 쓴다 */
  const [price] = useState(() => resolvePrice(resolvePriceVariant()));
  /**
   * 사진 가치 문항의 A/B 분리 property. 참가자 화면의 `UtSummaryCard`가 보내던 것과
   * 같은 값이라, 문항을 옮겨도 기존 분석이 그대로 이어진다.
   */
  const { answers } = useSession();
  const photoAnalysis = answers.observedAnalysis;
  const photoContext: AnalyticsProperties = {
    photo_used: (photoAnalysis?.evidenceCoverage.imageCount ?? 0) > 0,
    photo_count: photoAnalysis?.evidenceCoverage.imageCount ?? 0,
    usable_evidence_count: photoAnalysis?.evidenceCoverage.usableImageCount ?? 0,
    mode: photoAnalysis?.meta.mode ?? 'none',
  };

  const runCheck = useCallback(async () => {
    setRouteStatus(null);
    setParsable(sessionParsable());
    const entries = await Promise.all(
      UT_REQUIRED_ROUTES.map(async (route) => {
        try {
          const response = await fetch(route, { cache: 'no-store', redirect: 'manual' });
          return [route, response.status] as const;
        } catch {
          return [route, 0] as const;
        }
      }),
    );
    setRouteStatus(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  const health = routeStatus
    ? evaluateUtHealth({
        utMode,
        envUtMode: UT_MODE_DEPLOYMENT,
        access,
        overrideAccess: resolvePremiumAccess({
          utMode: true,
          fakeDoorEnabled: false,
          previewEnabled: false,
          paymentConfirmed: false,
        }),
        routeStatus,
        aiModeHint: AI_MODE_HINT,
        aiDebugVisible: AI_DEBUG,
        sessionParsable: parsable,
      })
    : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-4 overflow-y-auto bg-canvas px-4 py-6">
      <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted">UT OPERATOR</p>

      <section className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4">
        <p
          data-testid="ut-health-status"
          className={
            health === null
              ? 'text-section text-ink-muted'
              : health.ready
                ? 'text-section text-mint-ink'
                : 'text-section text-friction-text'
          }
        >
          {health === null ? '점검 중…' : health.ready ? 'UT READY' : 'UT BLOCKED'}
        </p>
        <ul className="flex flex-col gap-1.5">
          {(health?.items ?? []).map((item) => (
            <li
              key={item.id}
              data-testid={`ut-health-${item.id}`}
              data-status={item.status}
              className="flex flex-col text-[12.5px] keep-all"
            >
              <span>
                <span aria-hidden className="mr-1.5 font-semibold">
                  {MARK[item.status]}
                </span>
                {item.label}
              </span>
              {item.detail ? <span className="pl-5 text-[11.5px] text-ink-sub">{item.detail}</span> : null}
            </li>
          ))}
        </ul>
        <Button variant="secondary" onClick={() => void runCheck()}>
          다시 점검
        </Button>
      </section>

      {/*
        ══ 진행자 기록 · 인터뷰 문항 ═══════════════════════════════════════════

        260914 UT 후속 P1 Final이 S09 '관찰 유사도' 문항을 참가자 입력 흐름에서 여기로
        옮겼고, v1.48.1에서 **남아 있던 참가자 화면 평가 UI 전부**를 같은 자리로 모았다.

        옮긴 이유는 하나다: 제품을 쓰는 UI와 제품을 평가하는 UI를 섞지 않는다.
        참가자 화면에 `UT` 배지와 1~5 척도가 떠 있으면 제품이 프로토타입으로 읽히고,
        결과를 읽던 사람이 갑자기 설문 응답자가 된다.

        ⚠️ **이벤트 이름을 바꾸지 않았다.** 그래서 참가자 화면에서 걷어냈어도 기존
        지표와 그대로 이어진다 — 진행자가 해당 화면을 지난 뒤 구두로 묻고 기록한다.
        ⚠️ `/ut`는 dev 서버 · UT 배포에서만 열린다(Production 404) — 참가자에게 보이지 않는다.
        ⚠️ `ut_deep_report_missing_value`(자유서술)만 회수하지 않았다. 자유서술은
        Analytics 경로에 관계 민감 정보를 흘릴 수 있어(§24) 진행자 노트로 남긴다.
      */}
      <section className="flex flex-col gap-3">
        <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted">
          진행자 기록 · 인터뷰 문항
        </p>

        {INTERVIEW_MOMENTS.map((moment) => (
          <div key={moment.when} className="flex flex-col gap-2">
            <p className="text-[10px] font-semibold tracking-[0.1em] text-ink-faint">
              {moment.when}
            </p>

            {moment.scales.map((item) => (
              <UtRatingCard
                key={item.event}
                question={item.question}
                event={item.event}
                properties={{
                  ...item.properties,
                  ...(item.withPhotoContext ? photoContext : {}),
                  recorded_by: 'operator',
                }}
                lowLabel={item.lowLabel}
                highLabel={item.highLabel}
              />
            ))}

            {moment.choices?.map((item) => (
              <UtChoiceCard
                key={item.event}
                question={item.question(price)}
                event={item.event}
                options={item.options}
                properties={{ ...item.properties, price, recorded_by: 'operator' }}
              />
            ))}
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <Button variant="secondary" onClick={() => downloadUtExport()}>
          UT 결과 내보내기
        </Button>
        <Button onClick={() => setResetOpen(true)}>다음 참가자 준비 (초기화)</Button>
        <p className="text-[11.5px] keep-all leading-relaxed text-ink-sub">
          이 브라우저에 남은 참가자 답변 · 기록 · Premium 상태 · UT 응답 · AI 캐시를 지우고 온보딩을 연다. Supabase에 저장된 데이터는 건드리지 않는다.
        </p>
      </section>

      <ConfirmModal
        open={resetOpen}
        title="다음 참가자를 위해 초기화할까?"
        description="먼저 'UT 결과 내보내기'로 내려받아 뒀는지 확인해. 되돌릴 수 없어."
        confirmLabel="초기화"
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          clearParticipantStorage();
          window.location.replace(ROUTES.onboarding);
        }}
      />
    </main>
  );
}
