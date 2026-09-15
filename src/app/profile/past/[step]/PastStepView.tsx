'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/common/Button';
import { ChoiceChip } from '@/components/common/ChoiceChip';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { SelectableRow } from '@/components/common/SelectableRow';
import { InlineError, NoticeBox, PageHeading, Tag } from '@/components/common/primitives';
import { useToast } from '@/components/common/ToastProvider';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { LOVY_LINES, PRIVACY } from '@/data/copy';
import {
  MAX_PAST_FACTORS,
  MAX_PAST_OTHER_LENGTH,
  PAST_FACTOR_LABEL,
  PAST_FACTOR_ORDER,
} from '@/data/labels';
import {
  HARDEST_OPTIONS,
  PAST_NOTE_MAX,
  PAST_NOTE_PLACEHOLDER,
  PAST_PROGRESS,
  PAST_TOTAL,
  SELF_GAP_OPTIONS,
  type PastStep,
} from '@/data/pastQuestions';
import { trackEvent } from '@/lib/analytics';
import { pickAdaptiveTriggerAxis } from '@/lib/logic/mirror';
import { resolveReturnDestination, withReturnTo } from '@/lib/returnTo';
import { ROUTES } from '@/lib/routes';
import { useSession } from '@/state/SessionProvider';

/** S15~S17 Relationship Me — 구조화 입력 먼저, 서술은 선택 */
export function PastStepView({ step }: { step: PastStep }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const {
    answers,
    togglePastFactor,
    setHardest,
    setSelfGap,
    setPastNote,
    setPastImportantOther,
    markComplete,
    skipExperience,
    resumeExperience,
  } = useSession();
  const [error, setError] = useState<string | null>(null);

  const experience = answers.experience;
  const adaptiveShown = experience.adaptive !== null;
  const soloStatus = answers.status === 'solo_none' || answers.status === 'solo_exp';
  /** 입력 완료 뒤의 첫 목적지 — P0와 같다(S18 결과 화면을 거치지 않는다) */
  const afterProfileInput = soloStatus ? ROUTES.firstContact : ROUTES.target;
  const backHref =
    step === 1
      ? ROUTES.declared(4)
      : step === 3 && adaptiveShown
        ? ROUTES.pastAdaptive
        : ROUTES.past(step - 1);

  const validate = (): string | null => {
    if (step === 1 && experience.important.length === 0) {
      return '하나라도 골라줘. 이게 관계 속의 너를 읽는 기준이 돼.';
    }
    /*
      260915 UT P1-2 — '기타'는 **자유 입력을 여는 스위치**라 라벨만으로는 아무 근거도
      되지 않는다. 고르기만 하고 비워두면 다음 화면에서 '기타'라는 근거 없는 항목이
      생긴다. 다른 보기를 함께 골랐더라도 마찬가지다 — 비운 '기타'는 저장하지 않는다.
    */
    if (
      step === 1 &&
      experience.important.includes('other') &&
      experience.importantOther.trim().length === 0
    ) {
      return '‘기타’를 골랐으면 어떤 거였는지 한 줄만 적어줘.';
    }
    if (step === 2 && experience.hardest === null) {
      return '가장 가까운 쪽을 하나 골라줘.';
    }
    if (step === 3 && experience.selfGap === null) {
      return '연애 전과 실제 연애 속 너가 어땠는지 골라줘.';
    }
    return null;
  };

  /**
   * 260915 UT P1-1 — 심화 입력으로 간다.
   *
   * 마지막 단계의 필수 답(`selfGap`)은 먼저 받는다. 그래야 심화 질문을 고르는 규칙이
   * 사용자의 최신 답을 볼 수 있고, 돌아왔을 때 다시 물어보지 않는다.
   */
  const handleDeepInput = () => {
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    markComplete('experience');
    markComplete('profile');
    trackEvent('deep_input_open', { from: 'past_last_step' });
    router.push(withReturnTo(ROUTES.profileDeep, searchParams));
  };

  const handleNext = () => {
    const message = validate();
    if (message) {
      setError(message);
      return;
    }

    if (step === PAST_TOTAL) {
      markComplete('experience');
      trackEvent('relationship_experience_complete', {
        important_count: experience.important.length,
        hardest: experience.hardest ?? '',
        self_gap: experience.selfGap ?? '',
        has_note: experience.note.trim().length > 0,
      });
      /*
        260914 UT 후속 P0 — **입력 중간의 결과 화면(S18 `/profile/result`)을 건너뛴다.**
        참가자가 '뚝뚝 끊긴다 · 결과가 먼저 나와야'라고 반복했다. 입력은 상대 정보까지 한 흐름으로
        이어가고, 첫 결과는 궁합 점수부터 본다. S18은 Home 아바타 · 하단 '나' 탭에서 그대로 열린다.
        프로필 완료 표시는 S18 도착이 아니라 입력 완료 시점에 한다(Home · 하단 메뉴가 이 값을 본다).
        분기는 S18과 같다 — `soloModeOf`가 아니라 사용자가 답한 `answers.status`.
      */
      markComplete('profile');
      trackEvent('profile_complete', { path: 'experience' });
      // v1.11 — Profile Revisit에서 '이전 관계 경험 고치기'로 들어온 거면 그대로
      // /profile/result?view=revisit로 돌려보낸다(§27).
      router.push(resolveReturnDestination(searchParams, afterProfileInput));
      return;
    }

    // 예전에 '연애 경험이 없어'로 건너뛰었다가 돌아와 답하는 경우 — S14가 하던 일이다
    if (step === 1 && experience.skipped) resumeExperience();

    // Adaptive Follow-up — 모순 후보(GAP) 축이 방금 감지됐고 아직 안 물어봤으면
    // 과거 관계 질문 3번째로 바로 넘어가지 않고 추가 질문 1개를 먼저 보여준다.
    if (step === 2) {
      const triggerAxis = pickAdaptiveTriggerAxis(answers.declared, experience);
      if (triggerAxis && !adaptiveShown) {
        router.push(withReturnTo(ROUTES.pastAdaptive, searchParams));
        return;
      }
    }

    router.push(withReturnTo(ROUTES.past(step + 1), searchParams));
  };

  /**
   * 260914 UT 후속 P1 STEP 1 — '연애 경험이 없어'가 S14 인트로 화면에서 여기로 왔다.
   *
   * 예전 경로는 S14 → E4(`/profile/past/none`, 3 Layer 진행 상태 화면) → 다음이었다. 둘 다
   * 입력 중간의 전환 화면이라, 건너뛰면 곧바로 다음 입력(상대) · First Contact로 간다.
   * 완료 표시 · 이벤트는 E4가 하던 것과 같다(`path: 'no_experience'`).
   *
   * ⚠️ 이미 고른 요소가 있으면 버튼을 숨긴다 — 건너뛰기는 경험 답변을 비운다(`skipExperience`).
   */
  const handleSkip = () => {
    skipExperience();
    markComplete('experience');
    markComplete('profile');
    trackEvent('profile_complete', { path: 'no_experience' });
    router.push(resolveReturnDestination(searchParams, afterProfileInput));
  };

  return (
    <ScreenLayout
      header={
        <ScreenHeader
          backHref={backHref}
          progress={PAST_PROGRESS[step]}
          counter={`${step}/${PAST_TOTAL}`}
        />
      }
      footer={
        <div className="flex flex-col gap-2">
          {error ? <InlineError message={error} /> : null}
          {/*
            260915 UT P1-1 — **마지막 질문에서만** 심화 입력을 연다.

            "질문이 벌써 끝났어?"라는 반응이 나온 지점이 정확히 여기다. 기본 흐름을
            늘리지 않으면서 '더 말하고 싶다'는 사람에게만 길을 준다. 누르지 않으면
            존재하지 않는 화면이고, 결과도 그대로 나온다.

            ⚠️ 여기서 `markComplete`를 하지 않는다 — 심화 화면을 나갈 때가 아니라
            **이 단계를 통과할 때** 프로필이 완료된다는 규칙은 그대로다(`handleNext`).
          */}
          {step === PAST_TOTAL ? (
            <Button variant="text" onClick={handleDeepInput}>
              + 더 자세히 알려주기 (선택)
            </Button>
          ) : null}
          <Button onClick={handleNext}>
            {step === 1
              ? `다음 · ${experience.important.length}개 선택`
              : step === PAST_TOTAL
                ? '관찰 기록 만들기'
                : '다음'}
          </Button>
          {step === 1 && experience.important.length === 0 ? (
            <Button variant="text" onClick={handleSkip}>
              {/* 모쏠 · 첫 연애 중인 커플/배우자 모두에게 맞는 말. '돌아볼 관계가 없네' 같은 결핍 표현은 쓰지 않는다 */}
              이전 연애가 없어 · 건너뛰기
            </Button>
          ) : null}
        </div>
      }
      bodyClassName="pt-3 pb-3"
    >
      <div className="flex flex-col gap-[18px]">
        {step === 1 ? (
          <>
            {/*
              260914 UT 후속 P1 STEP 1 — S14 인트로('이번엔 네 기억을 조금 빌릴게')를 흡수했다.
              별도 화면 대신 첫 질문 위 한 줄로, 무엇을 몇 개 묻는지만 말한다.
            */}
            {/*
              260914 Relationship Language — 기능 이름은 '관계 경험'이다(`docs/RELATIONSHIP_LANGUAGE.md`).
              ⚠️ 아래 질문 문장('이전 관계에서 …')은 그대로 둔다. 이 답은 분석에서 **과거 시점 근거**
              (`evidenceScope: 'past'` · `이전 관계에서 …으로 선택`)로 쓰인다 — 지금 연인 · 배우자를 여기로
              부르면 그 근거 문장이 거짓이 된다. 지금 관계는 결과의 '지금 관계 속의 나'(S30)가 받는다.
            */}
            <LovyMessage pose="book" size={40}>
              이제 관계 경험을 짧게 돌아볼게. 질문 3개고, 누구와 만났는지는 묻지 않아.
              {answers.status === 'dating' || answers.status === 'married'
                ? ' 지금 만나는 사람 이야기는 결과 화면의 ‘지금 관계 속의 나’에서 따로 알려줄 수 있어.'
                : ''}
            </LovyMessage>
            <PageHeading
              lines={['이전 관계에서 생각보다 중요했던 건 뭐였어?']}
              caption={`여러 개 골라도 돼 · 최대 ${MAX_PAST_FACTORS}개`}
              eyebrow={
                <Tag tone="brand" className="self-start">
                  RELATIONSHIP ME
                </Tag>
              }
            />

            <div className="flex flex-wrap gap-[7px]" role="group" aria-label="중요했던 요소">
              {PAST_FACTOR_ORDER.map((factor) => {
                const selected = experience.important.includes(factor);
                return (
                  <ChoiceChip
                    key={factor}
                    multi
                    label={PAST_FACTOR_LABEL[factor]}
                    selected={selected}
                    onToggle={() => {
                      const accepted = togglePastFactor(factor);
                      if (!accepted) {
                        showToast(`최대 ${MAX_PAST_FACTORS}개까지 고를 수 있어`, 'warning');
                        return;
                      }
                      setError(null);
                    }}
                  />
                );
              })}
            </div>

            {/*
              260915 UT P1-2 — 보기 12개로 담기지 않는 것을 위한 칸.

              UT 요청: "이전 관계 선택지에 '기타'가 있어서 입력할 수 있게 했음 좋겠음(300자)"

              ⚠️ **고른 사람에게만 보인다.** 항상 펼쳐두면 모든 사용자가 '뭔가 더 적어야
              하나' 하고 멈춘다 — 이 입력은 선택이고, 비워도 되는 게 아니라 **고르지
              않으면 존재하지도 않는다.**
            */}
            {experience.important.includes('other') ? (
              <div className="flex flex-col gap-1.5">
                <label className="sr-only" htmlFor="past-important-other">
                  기타 — 어떤 것이 중요했는지
                </label>
                <textarea
                  id="past-important-other"
                  value={experience.importantOther}
                  onChange={(event) => {
                    setPastImportantOther(event.target.value);
                    setError(null);
                  }}
                  maxLength={MAX_PAST_OTHER_LENGTH}
                  rows={3}
                  placeholder="예) 답장이 늦으면 서운했어"
                  className="w-full resize-none rounded-row border border-line bg-surface p-3.5 text-sub leading-relaxed outline-none placeholder:text-ink-faint focus:border-brand"
                />
                <div className="flex items-center justify-between px-1">
                  <span className="text-meta text-ink-muted">
                    적어준 그대로만 볼게. 여기서 성격을 판단하지 않아.
                  </span>
                  <span className="flex-none text-meta text-ink-muted tnum">
                    {experience.importantOther.length}/{MAX_PAST_OTHER_LENGTH}
                  </span>
                </div>
              </div>
            ) : null}

            <NoticeBox>{PRIVACY.past}</NoticeBox>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <PageHeading
              lines={['가장 힘들었던 순간은 어떤 쪽에 가까웠어?']}
              eyebrow={
                <Tag tone="brand" className="self-start">
                  RELATIONSHIP ME
                </Tag>
              }
            />

            <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="가장 힘들었던 순간">
              {HARDEST_OPTIONS.map((option) => (
                <SelectableRow
                  key={option.value}
                  name="hardest"
                  value={option.value}
                  label={option.label}
                  description={option.description}
                  selected={experience.hardest === option.value}
                  onSelect={() => {
                    setHardest(option.value);
                    setError(null);
                  }}
                />
              ))}
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <PageHeading
              lines={['연애 전 생각했던 너와 실제 연애 속 너는 달랐어?']}
              eyebrow={
                <Tag tone="brand" className="self-start">
                  RELATIONSHIP ME
                </Tag>
              }
            />

            <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="자기 인식 차이">
              {SELF_GAP_OPTIONS.map((option) => (
                <SelectableRow
                  key={option.value}
                  name="self-gap"
                  value={option.value}
                  label={option.label}
                  selected={experience.selfGap === option.value}
                  onSelect={() => {
                    setSelfGap(option.value);
                    setError(null);
                  }}
                />
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="past-note" className="px-1 text-caption text-ink-sub">
                조금 더 설명하고 싶다면 적어줘 <span className="text-ink-faint">· 선택</span>
              </label>
              <textarea
                id="past-note"
                value={experience.note}
                onChange={(event) => setPastNote(event.target.value.slice(0, PAST_NOTE_MAX))}
                rows={4}
                placeholder={PAST_NOTE_PLACEHOLDER}
                className="w-full resize-none rounded-row border border-line bg-surface p-3.5 text-sub leading-relaxed outline-none placeholder:text-ink-faint focus:border-brand"
              />
              <p className="px-1 text-right text-meta text-ink-muted">
                {experience.note.length}/{PAST_NOTE_MAX}
              </p>
            </div>

            <LovyMessage pose="laptop" size={46}>
              {LOVY_LINES.pastNote}
            </LovyMessage>
          </>
        ) : null}
      </div>
    </ScreenLayout>
  );
}
