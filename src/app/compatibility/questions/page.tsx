'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { PageHeading } from '@/components/common/primitives';
import { useToast } from '@/components/common/ToastProvider';
import { ConversationCard } from '@/components/compatibility/ConversationCard';
import { BRAND } from '@/data/copy';
import { trackEvent } from '@/lib/analytics';
import { ROUTES } from '@/lib/routes';
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
                showToast(saved ? '질문을 저장했어요' : '저장을 해제했어요');
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
                    ? '질문을 클립보드에 복사했어요'
                    : outcome === 'shared'
                      ? '공유했어요'
                      : outcome === 'cancelled'
                        ? '공유를 취소했어요'
                        : '이 브라우저에서는 공유를 지원하지 않아요',
                  outcome === 'unsupported' ? 'warning' : 'default',
                );
              }}
            />
          ))}
        </ul>
      </div>
    </ScreenLayout>
  );
}
