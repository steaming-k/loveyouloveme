'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';

import { AiNarrativeNotice, AiSourceLabel } from '@/components/ai/AiModeNotice';
import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { PageHeading, SectionLabel } from '@/components/common/primitives';
import { useToast } from '@/components/common/ToastProvider';
import { ConversationCard } from '@/components/compatibility/ConversationCard';
import { BRAND } from '@/data/copy';
import { narrativeIsShowable } from '@/lib/aiEvidenceResolver';
import { trackEvent } from '@/lib/analytics';
import { ROUTES } from '@/lib/routes';
import { useCompatibilityNarrative, useEvidenceContext } from '@/hooks/useAiNarrative';
import { useConversationQuestions } from '@/hooks/useAnalysis';
import { useShare } from '@/hooks/useShare';
import { useSession } from '@/state/SessionProvider';

/**
 * S25 대화 질문 — 저장 상태가 실제로 세션에 남는다.
 * MBTI가 둘 다 입력돼 있으면 선호가 다른 축의 보조 질문이 관계 신호 질문 **뒤에** 덧붙는다.
 */
export default function ConversationQuestionsPage() {
  const router = useRouter();
  const questions = useConversationQuestions();
  const { answers, toggleSavedQuestion } = useSession();
  const { showToast } = useToast();
  const { share } = useShare('compatibility');

  const savedCount = answers.savedQuestions.length;
  const mbtiQuestionCount = questions.filter((question) => question.fromMbti).length;

  const narrative = useCompatibilityNarrative();
  const evidenceContext = useEvidenceContext();

  /**
   * AI가 만든 질문만 뽑는다. 근거(또는 한계)를 갖춘 Narrative에서 나온 질문만 쓴다 —
   * 근거 없는 해석에서 파생된 질문도 보여주지 않는다(§13/§35).
   */
  const aiQuestions = useMemo(() => {
    const items = narrative.data?.narratives ?? [];
    return items
      .filter(
        (item) => item.conversationQuestion && narrativeIsShowable(item, evidenceContext),
      )
      .map((item) => ({
        key: item.dimensionKey,
        text: item.conversationQuestion as string,
      }));
  }, [narrative.data, evidenceContext]);

  useEffect(() => {
    if (mbtiQuestionCount === 0) return;
    trackEvent('mbti_conversation_question_view', { count: mbtiQuestionCount });
  }, [mbtiQuestionCount]);

  return (
    <ScreenLayout
      header={<ScreenHeader backHref={ROUTES.compatibilityWhy} title="대화 질문" />}
      footer={
        <div className="flex flex-col gap-2">
          {savedCount > 0 ? (
            <p className="px-1 text-meta text-ink-muted">질문 {savedCount}개를 저장했어</p>
          ) : null}
          <Button onClick={() => router.push(ROUTES.mirrorTeaser)}>다음</Button>
        </div>
      }
      bodyClassName="pt-1.5 pb-4"
    >
      <div className="flex flex-col gap-4">
        <PageHeading
          lines={['이건 서로 물어봐도 좋겠는데?']}
          caption={
            mbtiQuestionCount > 0
              ? '차이가 보이는 항목에서 만든 질문이야. 뒤쪽은 MBTI 렌즈에서 나온 참고 질문이야.'
              : '차이가 보이는 항목에서 만든 질문이야.'
          }
          size="question"
        />

        <ul className="flex flex-col gap-2.5">
          {questions.map((question) => (
            <ConversationCard
              key={question.id}
              question={question}
              saved={answers.savedQuestions.includes(question.id)}
              onToggleSave={() => {
                const saved = toggleSavedQuestion(question.id);
                if (saved) trackEvent('conversation_question_save', { question: question.id });
                showToast(saved ? '질문을 저장했어' : '저장을 해제했어');
              }}
              onShare={async () => {
                trackEvent('conversation_question_share', { question: question.id });
                // 민감한 입력 데이터는 넣지 않고 질문 문장만 공유한다.
                const outcome = await share({
                  title: `${BRAND.name} · 이야기해볼 질문`,
                  text: question.text,
                });
                showToast(
                  outcome === 'copied'
                    ? '질문을 클립보드에 복사했어'
                    : outcome === 'shared'
                      ? '공유했어'
                      : outcome === 'cancelled'
                        ? '공유를 취소했어'
                        : '이 브라우저에서는 공유를 지원하지 않아',
                  outcome === 'unsupported' ? 'warning' : 'default',
                );
              }}
            />
          ))}
        </ul>

        {/*
          v1.7 — AI가 만든 질문은 **기존 질문을 대체하지 않고 뒤에 덧붙는다.**
          규칙 기반 질문이 사라지면 AI 실패 시 화면이 비어버린다. 위계상으로도
          축별 deterministic 질문이 먼저다.
        */}
        {aiQuestions.length > 0 ? (
          <section className="flex flex-col gap-2.5">
            <SectionLabel className="flex items-center gap-1.5">
              러비가 덧붙인 질문
              <AiSourceLabel mode={narrative.mode} />
            </SectionLabel>
            <ul className="flex flex-col gap-1.5">
              {aiQuestions.map((item) => (
                <li
                  key={item.key}
                  className="rounded-row border border-line bg-surface px-4 py-3.5 text-caption keep-all leading-relaxed"
                >
                  {item.text}
                </li>
              ))}
            </ul>
            <p className="px-1 text-meta keep-all text-ink-faint">
              차이가 보이는 항목에서 러비가 만든 질문이야. 확인해보고 싶은 것만 골라서 물어봐도 돼.
            </p>
          </section>
        ) : null}

        <AiNarrativeNotice
          task="compatibility-narrative"
          status={narrative.status}
          reason={narrative.reason}
        />
      </div>
    </ScreenLayout>
  );
}
