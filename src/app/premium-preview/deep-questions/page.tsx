'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/common/Button';
import { HydrationGate } from '@/components/common/HydrationGate';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { NoticeBox, PageHeading } from '@/components/common/primitives';
import { Lovy } from '@/components/lovy/Lovy';
import { selectDeepQuestions, type DeepQuestionTemplate } from '@/data/deepQuestions';
import { PREMIUM_PREVIEW } from '@/lib/env';
import { cn } from '@/lib/cn';
import { trackEvent } from '@/lib/analytics';
import { ROUTES } from '@/lib/routes';
import { useCrossSourceInsights } from '@/hooks/useAiNarrative';
import { useSession } from '@/state/SessionProvider';
import type { DeepAnalysisAnswer } from '@/types';

/**
 * Premium Adaptive Deep Question (v1.9 · §8~§11)
 *
 * 우선순위 Top 1~2 Insight의 축에서 질문 후보를 뽑는다(§9/§10) — 모든 사용자에게 같은
 * 질문을 주지 않는다. 실제 결제·리포트 연결이 없는 지금은 개발·UT 통로로만 연다 —
 * 프로덕션에서 아무 보상 없이 심층 답변을 모으지 않는다(§8).
 */
export default function DeepQuestionsPage() {
  return (
    <HydrationGate>
      <Suspense fallback={null}>
        <DeepQuestionsView />
      </Suspense>
    </HydrationGate>
  );
}

function DeepQuestionsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isBetaUt = searchParams.get('mode') === 'ut';
  const reportHref = isBetaUt
    ? `${ROUTES.premiumPreview('relationship_deep_report')}?mode=ut`
    : ROUTES.premiumPreview('relationship_deep_report');
  const { answers, addDeepAnswer } = useSession();
  /** Release Gate §1 — 외부 Analytics용 opaque 식별자 */
  const funnelAnalysisId = answers.currentAnalysisMeta?.funnelAnalysisId ?? null;
  const insights = useCrossSourceInsights();

  // 우선순위 Top 1~2 Insight의 축 — 같은 축이 여러 Insight에 걸쳐 반복돼도 질문은 축당 한 번만 뽑는다.
  const focusInsights = useMemo(() => {
    const seenAxes = new Set<string>();
    const picked: typeof insights = [];
    for (const insight of insights) {
      if (!insight.axis || seenAxes.has(insight.axis)) continue;
      seenAxes.add(insight.axis);
      picked.push(insight);
      if (picked.length >= 2) break;
    }
    return picked;
  }, [insights]);
  const focusAxes = useMemo(() => focusInsights.map((insight) => insight.axis!), [focusInsights]);
  const questions = useMemo(() => selectDeepQuestions(focusAxes), [focusAxes]);

  const [drafts, setDrafts] = useState<Record<string, { optionId: string; text: string }>>({});
  const startSent = useRef(false);

  useEffect(() => {
    if (startSent.current || questions.length === 0) return;
    startSent.current = true;
    // Release Gate §1 — analysis_id(답변 파생 지문) 대신 opaque funnel_analysis_id.
    trackEvent('deep_question_start', {
      count: questions.length,
      mode: isBetaUt ? 'beta_ut' : 'preview',
      ...(funnelAnalysisId ? { funnel_analysis_id: funnelAnalysisId } : {}),
    });
  }, [questions.length, isBetaUt, funnelAnalysisId]);

  if (!PREMIUM_PREVIEW) {
    return (
      <ScreenLayout
        header={<ScreenHeader backHref={ROUTES.home} title="추가 질문" />}
        footer={<Button onClick={() => router.replace(ROUTES.home)}>홈으로</Button>}
      >
        <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
          <Lovy pose="laptop" size={110} decorative />
          <p className="text-sub keep-all text-ink-sub">
            이 화면은 개발용이라 지금은 열려 있지 않아.
          </p>
        </div>
      </ScreenLayout>
    );
  }

  if (questions.length === 0) {
    return (
      <ScreenLayout
        header={<ScreenHeader backHref={reportHref} title="추가 질문" />}
        footer={
          <Button onClick={() => router.replace(reportHref)}>
            리포트로 돌아가기
          </Button>
        }
      >
        <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
          <Lovy pose="mug" size={110} decorative />
          <p className="text-sub keep-all text-ink-sub">
            지금은 물어볼 만큼 우선순위가 높은 지점이 없어.
          </p>
        </div>
      </ScreenLayout>
    );
  }

  const insightIdForAxis = (template: DeepQuestionTemplate): string | null =>
    focusInsights.find((insight) => insight.axis === template.axis)?.id ?? null;

  const handleSubmit = () => {
    for (const template of questions) {
      const draft = drafts[template.id];
      if (!draft) continue;
      const insightId = insightIdForAxis(template);
      if (!insightId) continue;

      const value =
        draft.optionId === 'custom' || !draft.optionId ? draft.text.trim() : draft.optionId;
      if (!value) continue;

      const answer: DeepAnalysisAnswer = {
        questionId: template.id,
        insightId,
        axis: template.axis,
        answerType: template.answerType,
        value,
        createdAt: new Date().toISOString(),
      };
      addDeepAnswer(answer);
    }
    router.push(reportHref);
  };

  const answeredCount = questions.filter((template) => {
    const draft = drafts[template.id];
    return draft && (draft.optionId ? draft.optionId !== 'custom' || draft.text.trim() : draft.text.trim());
  }).length;

  return (
    <ScreenLayout
      header={<ScreenHeader backHref={reportHref} title="추가로 몇 가지만" />}
      footer={
        <Button onClick={handleSubmit} disabled={answeredCount === 0}>
          답변 저장하고 리포트 보기 ({answeredCount}/{questions.length})
        </Button>
      }
      bodyClassName="pt-1.5 pb-4"
    >
      <div className="flex flex-col gap-5">
        <PageHeading
          lines={['조금 더 물어봐도 될까?']}
          caption="아까 본 연결 중 우선순위가 높은 지점에서만 골랐어. 대답 안 해도 리포트는 그대로 볼 수 있어."
        />

        {questions.map((template) => {
          const answeredInsight = insightIdForAxis(template);
          const draft = drafts[template.id] ?? { optionId: '', text: '' };

          return (
            <section
              key={template.id}
              className="flex flex-col gap-2.5 rounded-card border border-line bg-surface p-4"
            >
              {answeredInsight ? (
                <p className="text-[11px] keep-all leading-relaxed text-ink-muted">
                  {template.reason}
                </p>
              ) : null}
              <p className="text-body font-medium keep-all">{template.prompt}</p>

              {template.options ? (
                <div className="flex flex-col gap-1.5">
                  {template.options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={draft.optionId === option.id}
                      onClick={() =>
                        setDrafts((prev) => ({
                          ...prev,
                          [template.id]: { optionId: option.id, text: prev[template.id]?.text ?? '' },
                        }))
                      }
                      className={cn(
                        'min-h-11 rounded-[9px] border px-3.5 py-2.5 text-left text-caption transition-colors duration-200',
                        draft.optionId === option.id
                          ? 'border-brand bg-brand-tint font-semibold text-ink'
                          : 'border-line bg-surface active:bg-sunken',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {template.allowCustomText && (draft.optionId === 'custom' || !template.options) ? (
                <textarea
                  value={draft.text}
                  onChange={(event) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [template.id]: { optionId: prev[template.id]?.optionId ?? '', text: event.target.value },
                    }))
                  }
                  placeholder="직접 적어줘"
                  rows={2}
                  className="w-full resize-none rounded-[8px] border border-line bg-sunken p-2.5 text-[12.5px] keep-all outline-none"
                />
              ) : null}
            </section>
          );
        })}

        <NoticeBox>이 답변은 원래 답을 덮어쓰지 않아. 새로운 근거로만 추가돼.</NoticeBox>
      </div>
    </ScreenLayout>
  );
}
