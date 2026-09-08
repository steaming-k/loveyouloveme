'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo } from 'react';

import { Button } from '@/components/common/Button';
import { HydrationGate } from '@/components/common/HydrationGate';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { SelectableRow } from '@/components/common/SelectableRow';
import { PageHeading, SectionLabel, Tag } from '@/components/common/primitives';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { CURRENT_SIGNAL_QUESTIONS } from '@/data/currentRelationship';
import {
  jobInvitesCurrentEvidence,
  resolveRelationshipContext,
} from '@/lib/logic/relationshipStage';
import { ROUTES } from '@/lib/routes';
import { useSession } from '@/state/SessionProvider';

/**
 * S30 · Current Relationship Me — `/profile/current` (v1.41 · §39.5~§39.7)
 *
 * ══ 이 화면이 존재하는 이유 ═══════════════════════════════════════════════
 *
 * v1.40이 `dating`·`long_term`에게 `지금 관계에서 기대를 조율한다`는 Job을 줬는데,
 * 제품이 가진 관계 근거는 S15~S17(`이전 관계에서 …`) 하나뿐이었다. **한 번도 물어본
 * 적 없는 관계에 대해 조율을 제안하고 있었다.** 이 화면이 그 근거를 받는다.
 *
 * ══ 이 화면이 하지 않는 것 ═══════════════════════════════════════════════
 *
 * **① 필수 관문이 아니다.** Core Funnel의 어느 경로도 이 화면을 지나지 않는다.
 * S13 → S14(과거) → S18 → S19 → 궁합은 v1.40.1과 **완전히 같다.** 여기 오는 길은
 * `/compatibility`의 `04 NOW WHAT`에 붙은 **한 줄 링크** 하나뿐이고, 답하지 않아도
 * 모든 결과가 그대로 나온다(§39.5 — 답하지 않아 Core가 막히면 FAIL).
 *
 * **② 4축을 다시 설문하지 않는다.** 축마다 질문 **하나**, 보기 4개다. 진행 차단
 * 없음, 자유서술 없음. 다 답해도 5탭이고 한 축만 답해도 그 축만 근거가 된다(§39.6).
 *
 * **③ 상대를 묻지 않는다.** 다섯 질문 전부 주어가 나다. `이 관계는 건강해?` ·
 * `상대는 회피형이야?` 같은 질문은 만들지 않는다 — 우리는 상대의 행동도 마음도
 * 받지 않으므로 그 답을 근거로 쓸 수 없다(§39.7 · `data/currentRelationship.ts`).
 *
 * ⚠️ **`dating`·`long_term`이 아니면 조용히 결과로 돌려보낸다.** 없는 관계에 대해
 * `지금 관계에서는?`이라고 묻는 것은 그 자체로 관계를 전제하는 것이고, `ended`에게는
 * 끝난 관계를 다시 관찰하게 만드는 반추 루프다(§37.13). 단 **이미 답해 둔 값은
 * 지우지도 무시하지도 않는다** — 수집 정책과 해석 정책은 분리된다.
 */
export default function CurrentRelationshipPage() {
  return (
    <HydrationGate>
      <Suspense fallback={null}>
        <CurrentRelationshipView />
      </Suspense>
    </HydrationGate>
  );
}

function CurrentRelationshipView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { answers, setCurrentSignal, clearCurrentSignal, markCurrentEvidenceAsked } = useSession();

  const job = useMemo(() => resolveRelationshipContext(answers).job, [answers]);
  const invited = jobInvitesCurrentEvidence(job);
  const signals = answers.currentRelationship.signals;

  /** 이 화면을 열었다는 사실만 기록한다 — 답하지 않고 나가도 같은 권유를 반복하지 않는다 */
  useEffect(() => {
    if (invited) markCurrentEvidenceAsked();
  }, [invited, markCurrentEvidenceAsked]);

  useEffect(() => {
    if (!invited) router.replace(ROUTES.compatibility);
  }, [invited, router]);

  if (!invited) return null;

  const answeredCount = CURRENT_SIGNAL_QUESTIONS.filter(
    (question) => signals[question.axis] !== undefined,
  ).length;

  const backHref = searchParams.get('from') === 'mirror' ? ROUTES.mirror : ROUTES.compatibility;

  return (
    <ScreenLayout
      /*
        ⚠️ **`title`을 넘기지 않는다.** `ScreenHeader`의 title은 `<h2>`이고 아래
        `PageHeading`이 `<h1>`이라, title을 함께 넘기면 heading 순서가 **H2 → H1**로
        역전된다(375px 실측에서 확인). v1.29 §58·v1.36이 리포트 화면에서 고친 것과
        같은 결함이므로 같은 방법으로 피한다 — 화면 이름은 h1이 말한다.
      */
      header={<ScreenHeader backHref={backHref} />}
      footer={
        <Button onClick={() => router.push(backHref)}>
          {answeredCount > 0 ? '결과에 반영하기' : '결과로 돌아가기'}
        </Button>
      }
      bodyClassName="pt-4 pb-3"
    >
      <div className="flex flex-col gap-6">
        <LovyMessage pose="question" size={44} tone="lead">
          {'지금까지는 이전 관계에서의 너를 봤어. 지금 관계에서는 어떤지도 알려줄래?'}
        </LovyMessage>

        <PageHeading
          lines={['지금 관계 속의 나']}
          size="question"
          caption="답하고 싶은 것만 골라도 돼. 한 항목만 답해도 그 항목은 지금 관계 기준으로 다시 볼게 — 답하지 않은 항목은 이전 관계 기준을 그대로 써."
          eyebrow={
            <Tag tone="brand" className="self-start">
              CURRENT RELATIONSHIP ME
            </Tag>
          }
        />

        {CURRENT_SIGNAL_QUESTIONS.map((question) => {
          const selected = signals[question.axis];
          return (
            <section key={question.axis} className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <SectionLabel as="h2">{question.label}</SectionLabel>
                {/*
                  답을 **되돌릴 수 있어야 한다.** 실수로 고른 답을 지울 방법이 없으면
                  사용자는 틀린 근거를 남긴 채 나가게 되고, 그 근거가 Mirror 판정과
                  History Snapshot에 그대로 들어간다.

                  ⚠️ 처음에는 '같은 보기를 다시 누르면 해제'로 만들었는데 **동작하지
                  않았다** — `SelectableRow`는 실제 `<input type="radio">`를 쓰고,
                  이미 checked인 radio를 다시 클릭하면 `change` 이벤트가 발생하지
                  않는다(브라우저 실측). 화면은 되돌릴 수 있다고 약속하고 코드는
                  못 하는 상태였다. 공용 컴포넌트에 해제를 넣는 대신(S05·S11·S16·S17은
                  전부 **필수 단일 선택**이라 해제가 생기면 진행 차단이 무너진다)
                  이 화면에만 명시적인 버튼을 둔다.

                  ⚠️ 답이 있을 때만 보인다. 지울 것이 없는데 '지우기'를 두면 그 자체가
                  답을 요구하는 신호로 읽힌다.
                */}
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
              <div
                className="flex flex-col gap-2.5"
                role="radiogroup"
                aria-label={question.question}
              >
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

        <p className="px-1 text-meta keep-all leading-relaxed text-ink-muted">
          {
            '이 답은 동기화율에 들어가지 않아. 상대에 대한 판단도 만들지 않아 — 여기서 묻는 건 전부 너에 대한 거야.'
          }
        </p>
      </div>
    </ScreenLayout>
  );
}
