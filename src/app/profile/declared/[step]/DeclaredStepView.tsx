'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/common/Button';
import { ChoiceChip } from '@/components/common/ChoiceChip';
import { ScaleSelector } from '@/components/common/ScaleSelector';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { SelectableRow } from '@/components/common/SelectableRow';
import { Divider, InlineError, PageHeading, Tag } from '@/components/common/primitives';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import {
  DECLARED_QUESTIONS,
  DECLARED_TOTAL,
  type DeclaredStep,
} from '@/data/declaredQuestions';
import { MBTI_TYPES } from '@/data/mbti';
import { trackEvent } from '@/lib/analytics';
import { resolveReturnDestination, withReturnTo } from '@/lib/returnTo';
import { ROUTES } from '@/lib/routes';
import { isDeclaredStepComplete } from '@/lib/validation';
import { useSession } from '@/state/SessionProvider';
import type { AffectionStyle, ConflictStyle, HobbyStyle, ScaleValue } from '@/types';

/**
 * S10~S13 Declared Me — Progressive Question Flow
 * 한 화면에 질문 하나(마지막만 둘). Back으로 돌아와도 값이 유지된다.
 *
 * S13에는 내 MBTI Optional Section(Personality Lens)이 함께 있다. MBTI는 Declared 답변이
 * 아니라 별도 데이터(answers.mbti)이며, 미선택이어도 진행을 막지 않는다.
 */
export function DeclaredStepView({ step }: { step: DeclaredStep }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { answers, setDeclared, setMbti, markComplete } = useSession();
  const [error, setError] = useState<string | null>(null);

  const config = DECLARED_QUESTIONS[step];
  const declared = answers.declared;

  const backHref = step === 1 ? ROUTES.observed : ROUTES.declared(step - 1);

  const handleNext = () => {
    if (!isDeclaredStepComplete(declared, step)) {
      setError(
        config.questions.length > 1
          ? '두 질문 모두 골라줘. 하나만 있으면 비교가 안 돼.'
          : '아직 답을 안 골랐어. 지금 생각하는 기준으로 답해도 괜찮아.',
      );
      return;
    }

    if (step === DECLARED_TOTAL) {
      markComplete('declared');
      trackEvent('declared_me_complete', {
        contact: declared.contact ?? 0,
        alone: declared.alone ?? 0,
        conflict: declared.conflict ?? '',
        affection: declared.affection ?? '',
        hobby: declared.hobby ?? '',
        // MBTI는 Optional이므로 완료 조건이 아니다. 입력률만 함께 관찰한다.
        mbti: answers.mbti ?? '',
      });
      // v1.11 — Profile Revisit에서 '관계 성향 답변 고치기'로 들어온 거면 Past Funnel로
      // 계속 밀지 않고 Profile Revisit으로 돌려보낸다(§27).
      router.push(resolveReturnDestination(searchParams, ROUTES.pastIntro));
      return;
    }

    router.push(withReturnTo(ROUTES.declared(step + 1), searchParams));
  };

  return (
    <ScreenLayout
      header={
        <ScreenHeader backHref={backHref} progress={config.progress} counter={config.counter} />
      }
      footer={
        <div className="flex flex-col gap-2">
          {error ? <InlineError message={error} /> : null}
          <Button onClick={handleNext}>다음</Button>
        </div>
      }
      bodyClassName="pt-3.5 pb-3"
    >
      <div className="flex flex-col gap-7">
        {config.questions.map((question, index) => (
          <div key={question.field} className="flex flex-col gap-3.5">
            {index > 0 ? <Divider className="-mt-1" /> : null}

            <PageHeading
              lines={question.title}
              caption={'description' in question ? question.description : undefined}
              size={config.questions.length > 1 ? 'title' : 'question'}
              eyebrow={
                index === 0 && config.questions.length === 1 ? (
                  <Tag tone="brand" className="self-start">
                    DECLARED ME
                  </Tag>
                ) : undefined
              }
            />

            {question.kind === 'scale' ? (
              <ScaleSelector
                legend={question.title.join(' ')}
                value={declared[question.field]}
                minLabel={question.minLabel}
                maxLabel={question.maxLabel}
                onChange={(value: ScaleValue) => {
                  setDeclared(question.field, value);
                  setError(null);
                }}
              />
            ) : null}

            {question.kind === 'rows' ? (
              <div className="flex flex-col gap-2.5" role="radiogroup" aria-label={question.title.join(' ')}>
                {question.options.map((option) => (
                  <SelectableRow
                    key={option.value}
                    name={question.field}
                    value={option.value}
                    label={option.label}
                    description={option.description}
                    selected={declared.conflict === option.value}
                    onSelect={() => {
                      setDeclared('conflict', option.value as ConflictStyle);
                      setError(null);
                    }}
                  />
                ))}
              </div>
            ) : null}

            {question.kind === 'chips' ? (
              <div
                className="flex flex-wrap gap-[7px]"
                role="radiogroup"
                aria-label={question.title.join(' ')}
              >
                {question.options.map((option) => (
                  <ChoiceChip
                    key={option.value}
                    label={option.label}
                    selected={declared[question.field] === option.value}
                    onToggle={() => {
                      if (question.field === 'affection') {
                        setDeclared('affection', option.value as AffectionStyle);
                      } else {
                        setDeclared('hobby', option.value as HobbyStyle);
                      }
                      setError(null);
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ))}

        {config.personalityLens ? (
          <div className="flex flex-col gap-3.5">
            <Divider className="-mt-1" />

            <div className="flex flex-col gap-2 px-1">
              <Tag tone="neutral" className="self-start">
                {config.personalityLens.eyebrow}
              </Tag>
              <h2 className="text-title keep-all">{config.personalityLens.title}</h2>
              <p className="text-caption keep-all text-ink-sub">
                {config.personalityLens.caption}
              </p>
            </div>

            <div className="flex flex-wrap gap-[7px]" role="radiogroup" aria-label="내 MBTI (선택)">
              {MBTI_TYPES.map((type) => (
                <ChoiceChip
                  key={type}
                  label={type}
                  selected={answers.mbti === type}
                  onToggle={() => setMbti(answers.mbti === type ? null : type)}
                />
              ))}
              <ChoiceChip
                label={config.personalityLens.skipLabel}
                selected={answers.mbti === null}
                onToggle={() => setMbti(null)}
              />
            </div>
          </div>
        ) : null}

        {config.observedCompare ? (
          <div className="flex flex-col gap-1.5 rounded-row border border-line bg-surface px-[15px] py-3.5">
            <p className="text-[11px] font-semibold tracking-[0.05em] text-mint-text">
              {config.observedCompare.title}
            </p>
            <p className="text-caption leading-relaxed keep-all text-[#555]">
              {config.observedCompare.body[0]}
              <b className="font-semibold text-ink">{config.observedCompare.body[1]}</b>
              {config.observedCompare.body[2]}
            </p>
          </div>
        ) : null}

        {config.lovyNote ? (
          <LovyMessage pose={config.lovyNote.pose} size={config.lovyNote.size}>
            {config.lovyNote.message}
          </LovyMessage>
        ) : null}
      </div>
    </ScreenLayout>
  );
}
