'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { SelectableRow } from '@/components/common/SelectableRow';
import { NoticeBox, PageHeading, Tag } from '@/components/common/primitives';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { selectDeepInputQuestions } from '@/data/relationshipDeepInput';
import { trackEvent } from '@/lib/analytics';
import { resolveReturnDestination } from '@/lib/returnTo';
import { ROUTES } from '@/lib/routes';
import { useSession } from '@/state/SessionProvider';

/**
 * S14b Optional Deep Input (260915 UT P1-1)
 *
 * ══ 이 화면이 지켜야 하는 것 ══════════════════════════════════════════════
 *
 * ```
 * 언제든 나갈 수 있다      '이만 됐어'가 항상 보인다. 답하지 않아도 결과는 그대로다
 * 최대 2문항              끝이 보이는 길이여야 '또 질문이네'가 되지 않는다
 * 점수를 바꾸지 않는다     화면이 그 사실을 직접 말한다 — 답을 유도하지 않기 위해서다
 * ```
 *
 * ⚠️ **질문을 여기서 만들지 않는다.** `selectDeepInputQuestions`가 사용자의 기존 답에서
 * 규칙으로 고른다(§20). 그래서 같은 입력이면 항상 같은 질문이 나온다.
 *
 * ⚠️ 이미 답한 질문은 목록에서 빠지므로, 두 번째로 들어오면 다음 질문이 나온다.
 * 더 고를 게 없으면 화면을 만들지 않고 바로 다음으로 보낸다.
 */
export function DeepInputView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { answers, setDeepInput } = useSession();

  /*
    ⚠️ 질문 목록을 **마운트 시점에 고정한다.** 답할 때마다 다시 고르면 방금 답한 질문이
    목록에서 빠지면서 화면이 통째로 갈아엎어진다 — 사용자는 자기가 무엇에 답했는지
    잃어버린다. `answers`를 의존성에 넣지 않은 것은 의도다.
  */
  const [questions] = useState(() => selectDeepInputQuestions(answers));

  const answeredById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of answers.deepInputs) map.set(item.questionId, item.optionId);
    return map;
  }, [answers.deepInputs]);

  const answeredHere = questions.filter((question) => answeredById.has(question.id)).length;

  const leave = (reason: 'done' | 'skip') => {
    trackEvent(reason === 'done' ? 'deep_input_answer' : 'deep_input_skip', {
      answered: answeredHere,
      offered: questions.length,
    });
    /*
      기본 목적지는 관계 경험 마지막 단계와 **같은 규칙**이다 — solo면 First Contact,
      아니면 상대 입력. 여기서 목적지를 새로 정하면 심화 입력을 연 사용자만 다른 곳에
      도착한다.
    */
    const solo = answers.status === 'solo_none' || answers.status === 'solo_exp';
    router.push(
      resolveReturnDestination(searchParams, solo ? ROUTES.firstContact : ROUTES.target),
    );
  };

  /* 더 물어볼 게 없으면 화면을 세우지 않는다 */
  if (questions.length === 0) {
    return (
      <ScreenLayout
        header={<ScreenHeader backHref={ROUTES.past(3)} />}
        footer={<Button onClick={() => leave('done')}>다음으로</Button>}
        bodyClassName="pt-1.5 pb-3"
      >
        <LovyMessage pose="question" size={44} tone="lead">
          지금 답해준 것만으로도 볼 수 있는 게 있어. 더 물어볼 건 관계 이야기가 쌓이면 그때 물어볼게.
        </LovyMessage>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      header={<ScreenHeader backHref={ROUTES.past(3)} title="조금 더 자세히" />}
      footer={
        <div className="flex flex-col gap-1.5">
          <Button onClick={() => leave('done')}>
            {answeredHere > 0 ? '다 답했어 · 계속하기' : '다음으로'}
          </Button>
          {/* 언제든 나갈 수 있다는 것이 이 기능의 전제다 */}
          <Button variant="text" onClick={() => leave('skip')}>
            이만 됐어
          </Button>
        </div>
      }
      bodyClassName="pt-1.5 pb-3"
    >
      <div className="flex flex-col gap-5">
        <LovyMessage pose="question" size={44} tone="lead">
          네가 중요하다고 답한 것부터 {questions.length}가지만 더 물어볼게. 답하면 결과에서 그
          조건까지 같이 볼 수 있어.
        </LovyMessage>

        {questions.map((question, index) => (
          <div key={question.id} className="flex flex-col gap-2.5">
            <PageHeading
              lines={[question.question]}
              caption={question.caption}
              eyebrow={
                <Tag tone="brand" className="self-start">
                  {index + 1}/{questions.length}
                </Tag>
              }
            />
            <div
              className="flex flex-col gap-1.5"
              role="radiogroup"
              aria-label={question.question}
            >
              {question.options.map((option) => (
                <SelectableRow
                  key={option.id}
                  label={option.label}
                  name={question.id}
                  value={option.id}
                  selected={answeredById.get(question.id) === option.id}
                  onSelect={() =>
                    setDeepInput({
                      axis: question.axis,
                      questionId: question.id,
                      optionId: option.id,
                    })
                  }
                />
              ))}
            </div>
          </div>
        ))}

        {/*
          답을 유도하지 않기 위해 **점수와 무관하다는 사실을 먼저 말한다.**
          '더 답하면 점수가 올라간다'고 읽히면 사용자는 진짜 답 대신 좋아 보이는 답을 고른다.
        */}
        <NoticeBox>
          여기 답은 동기화율 점수에 들어가지 않아. 결과에서 어떤 조건인지 더 좁혀 보는 데만 써.
        </NoticeBox>
      </div>
    </ScreenLayout>
  );
}
