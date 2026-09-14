'use client';

import { useId, useState } from 'react';

import { OptionalDisclosureButton } from '@/components/common/OptionalDisclosureButton';
import { SelectableRow } from '@/components/common/SelectableRow';
import { SectionLabel } from '@/components/common/primitives';
import { CURRENT_SIGNAL_QUESTIONS } from '@/data/currentRelationship';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { answeredAxisCount } from '@/lib/logic/relationshipEvidence';
import { useSession } from '@/state/SessionProvider';

/**
 * S30 질문 목록 — `/profile/current` 화면과 결과 안 accordion이 **같은 목록**을 쓴다.
 *
 * ⚠️ 해제는 명시적 버튼으로만 한다 — `SelectableRow`는 실제 radio라 같은 보기를 다시 눌러도
 * change가 발생하지 않는다(v1.41 실측). 이 규칙은 `/profile/current`에서 옮겨왔다.
 */
export function CurrentSignalQuestionList({
  headingLevel = 'h2',
}: {
  headingLevel?: 'h2' | 'h3';
}) {
  const { answers, setCurrentSignal, clearCurrentSignal } = useSession();
  const signals = answers.currentRelationship.signals;

  return (
    <>
      {CURRENT_SIGNAL_QUESTIONS.map((question) => {
        const selected = signals[question.axis];
        return (
          <section key={question.axis} className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <SectionLabel as={headingLevel}>{question.label}</SectionLabel>
              {selected !== undefined ? (
                <button
                  type="button"
                  onClick={() => clearCurrentSignal(question.axis)}
                  className="flex min-h-11 items-center px-1 text-meta font-medium text-ink-muted"
                >
                  답 지우기
                </button>
              ) : null}
            </div>
            <p className="px-1 text-sub keep-all text-ink-sub">{question.question}</p>
            <div className="flex flex-col gap-2.5" role="radiogroup" aria-label={question.question}>
              {question.options.map((option) => (
                <SelectableRow
                  key={option.value}
                  name={`current-${question.axis}`}
                  value={option.value}
                  label={option.label}
                  selected={selected === option.value}
                  onSelect={() => setCurrentSignal(question.axis, option.value)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

/**
 * '지금 관계 속의 나' — 결과 안에서 펼쳐보는 형태 (260914 UT 후속 P1 STEP 6)
 *
 * UT에서 별도 화면 전체를 차지하는 구조가 흐름을 끊었고, 참가자는 결과 안에서 필요할 때
 * 펼쳐보는 쪽을 원했다. 그래서 **기본 접힘**으로 결과 안에 둔다.
 *
 * ⚠️ 데이터 · 판정은 그대로다 — 같은 `setCurrentSignal`을 쓰고, 동기화율에는 들어가지 않는다.
 * ⚠️ `/profile/current` Route는 남아 있다(기존 링크 · 뒤로가기 호환). 같은 질문 목록을 쓴다.
 * ⚠️ 이 컴포넌트를 그릴지는 호출부가 `jobInvitesCurrentEvidence`로 정한다(dating · long_term만).
 */
export function CurrentRelationshipInline({ className }: { className?: string }) {
  const { answers, markCurrentEvidenceAsked } = useSession();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const answered = answeredAxisCount(answers.currentRelationship);

  return (
    <section
      className={cn('flex flex-col gap-3 rounded-[16px] border border-line bg-surface p-4', className)}
    >
      <OptionalDisclosureButton
        panelId={panelId}
        open={open}
        onToggle={() => {
          const next = !open;
          setOpen(next);
          if (next) {
            // 열어봤다는 사실만 기록한다 — 답하지 않고 닫아도 같은 권유를 반복하지 않는다(S30과 같다)
            markCurrentEvidenceAsked();
            trackEvent('result_section_expand', { section: 'current_relationship' });
          }
        }}
        eyebrow="CURRENT RELATIONSHIP ME"
        title="지금 관계 속의 나"
        hint={
          answered === 0
            ? '지금 해석은 네가 이전 관계에서 답한 내용을 기준으로 했어.'
            : `지금 관계 기준으로 답한 항목 ${answered}개가 반영돼 있어. 언제든 고칠 수 있어.`
        }
        benefit="알려주면 그 항목은 지금 관계 기준으로 다시 볼게"
        filledLabel={answered > 0 ? `${answered}개` : undefined}
      />

      {open ? (
        <div id={panelId} className="flex flex-col gap-5 pt-1">
          <CurrentSignalQuestionList headingLevel="h3" />
          <p className="px-1 text-meta keep-all leading-relaxed text-ink-muted">
            답하고 싶은 것만 골라도 돼. 이 답은 동기화율에 들어가지 않고, 상대에 대한 판단도 만들지 않아.
          </p>
        </div>
      ) : null}
    </section>
  );
}
