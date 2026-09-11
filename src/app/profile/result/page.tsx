'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

import { BottomNavigation } from '@/components/common/BottomNavigation';
import { BottomSheet } from '@/components/common/BottomSheet';
import { Button } from '@/components/common/Button';
import { HydrationGate } from '@/components/common/HydrationGate';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { EmptyStateView, FillDataRow } from '@/components/common/StateScreens';
import { ConfidenceLabel, NoticeBox, PageHeading, Tag } from '@/components/common/primitives';
import { useToast } from '@/components/common/ToastProvider';
import { ProfileLayerStack } from '@/components/profile/ProfileLayerStack';
import { PRIVACY } from '@/data/copy';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { formatBirthSummary } from '@/lib/logic/birth';
import { PROFILE_REVISIT_RETURN, RETURN_TO_PARAM } from '@/lib/returnTo';
import { isRevisit, revisitHref, revisitSource } from '@/lib/resultView';
import { ROUTES } from '@/lib/routes';
import { canBuildProfile } from '@/lib/validation';
import { useRelationshipProfile } from '@/hooks/useAnalysis';
import { useSession } from '@/state/SessionProvider';

/**
 * S18 Relationship Profile — 첫 번째 핵심 결과 화면
 * 세 관찰(Observed / Declared / Relationship)을 하나의 프로필로 연결하고,
 * 사용자가 '맞다 / 조금 다르다'로 확인할 수 있게 한다.
 */
export default function ProfileResultPage() {
  // v1.11 — ProfileResultView가 Revisit 판정(§25)을 위해 useSearchParams()를 쓴다.
  return (
    <Suspense fallback={null}>
      <HydrationGate>
        <ProfileResultView />
      </HydrationGate>
    </Suspense>
  );
}

function ProfileResultView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { answers, markComplete } = useSession();
  /**
   * 지금 특정 상대가 없다고 **사용자가 직접 답한** 상태인가 (v1.29 P4).
   *
   * ⚠️ `soloModeOf`를 쓰지 않는다. 그 함수는 target 입력량을 보는데 이 화면은 target
   * 입력 **전**이라 모든 사용자가 `no_target`으로 읽힌다 — 그러면 커플 퍼널이 끊긴다.
   */
  const soloStatus = answers.status === 'solo_none' || answers.status === 'solo_exp';
  const profile = useRelationshipProfile();

  const [feedback, setFeedback] = useState<'ok' | 'no' | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const ready = canBuildProfile(answers);
  const revisit = isRevisit(searchParams);

  /** Revisit에서 편집 Route로 보낼 때만 `from`을 붙인다 — 첫 방문 수정은 원래 Funnel 그대로 */
  const editHref = (base: string) =>
    revisit ? `${base}?${RETURN_TO_PARAM}=${PROFILE_REVISIT_RETURN}` : base;

  useEffect(() => {
    if (!ready) return;
    markComplete('profile');
    trackEvent('profile_complete', {
      confidence: profile.confidence,
      // v1.37 — 관찰이 없으면 observed 레이어 자체가 빠진다. 인덱스로 잡으면
      // Declared 개수를 Observed 개수라고 보내게 된다.
      observed_items: profile.layers.find((layer) => layer.id === 'observed')?.items.length ?? 0,
    });
  }, [ready, markComplete, profile.confidence, profile.layers]);

  const revisitFiredRef = useRef(false);
  useEffect(() => {
    // StrictMode 이중 마운트로 중복 발생하지 않게 mount 기준 1회만(§86 패턴과 동일)
    if (!revisit || !ready || revisitFiredRef.current) return;
    revisitFiredRef.current = true;
    trackEvent('profile_result_revisit', { source: revisitSource(searchParams) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revisit, ready]);

  if (!ready) {
    return (
      <ScreenLayout
        /* v1.36 A11y — `EmptyStateView`가 h1을 그린다. title(h2)을 앞에 두지 않는다 */
        header={<ScreenHeader backHref={ROUTES.pastIntro} />}
        footer={
          <Button onClick={() => router.push(ROUTES.declared(1))}>관측 기록 채우기</Button>
        }
      >
        <EmptyStateView
          actions={
            <div className="flex flex-col gap-2">
              <FillDataRow
                label="관계 성향 질문 4개"
                onClick={() => router.push(ROUTES.declared(1))}
              />
              <FillDataRow
                label="관계 경험 질문 3개"
                onClick={() => router.push(ROUTES.past(1))}
              />
              <FillDataRow label="사진 다시 고르기" onClick={() => router.push(ROUTES.photos)} />
            </div>
          }
        />
      </ScreenLayout>
    );
  }

  return (
    <>
      <ScreenLayout
        header={
          <ScreenHeader
            backHref={revisit ? ROUTES.home : ROUTES.past(3)}
            title={revisit ? '내 관계 프로필' : undefined}
            action={
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="flex h-11 items-center px-1 text-caption text-ink-sub"
              >
                수정
              </button>
            }
          />
        }
        footer={
          revisit ? (
            <div className="flex flex-col gap-2.5">
              <Button onClick={() => setEditOpen(true)}>정보 수정</Button>
              <Button
                variant="secondary"
                onClick={() => router.push(revisitHref(ROUTES.mirror, 'direct'))}
              >
                최근 Mirror 보기
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {/*
                v1.29 P4 — **Solo에게 '상대를 관찰하기'만 주지 않는다.**

                v1.28까지 이 자리의 유일한 다음 걸음은 `/target`이었다. 그래서 지금
                특정 상대가 없다고 답한 사용자도 상대 입력 화면으로 갔고, 입력할 게 없어
                동기화율 `?`를 보고 끝났다(P4 Audit 실측).

                ⚠️ 분기는 `soloModeOf`가 아니라 **`answers.status`**로 한다. 이 시점에는
                target이 아직 비어 있어서 모든 사용자가 `no_target`으로 읽히기 때문이다 —
                여기서 `soloModeOf`를 쓰면 커플 퍼널이 통째로 끊긴다.

                상대 입력을 없애지는 않는다. 솔로라고 답했어도 그 사이에 누가 생길 수 있다.
              */}
              {soloStatus ? (
                <>
                  <Button onClick={() => router.push(ROUTES.firstContact)}>
                    내 관계 관찰 보기
                  </Button>
                  <Button variant="text" onClick={() => router.push(ROUTES.target)}>
                    관심 가는 사람이 있어
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={() => {
                      router.push(ROUTES.target);
                    }}
                  >
                    이제 상대를 관찰하기
                  </Button>
                  <Button variant="text" onClick={() => setEditOpen(true)}>
                    관찰 기록 수정하기
                  </Button>
                </>
              )}
            </div>
          )
        }
        nav={revisit ? <BottomNavigation /> : undefined}
        bodyClassName="pt-1 pb-4"
      >
        <div className="flex flex-col gap-4">
          <PageHeading
            lines={['러비가 관찰한', '현재의 너']}
            size="hero"
            eyebrow={
              <div className="flex flex-wrap items-center gap-1.5">
                <Tag tone="mint">관측 완료</Tag>
                <ConfidenceLabel confidence={profile.confidence} />
              </div>
            }
          />

          <ProfileLayerStack
            layers={profile.layers}
            coreInsight={profile.coreInsight}
            mbti={answers.mbti}
          />

          <div className="flex flex-col gap-2.5 rounded-card border border-line bg-surface p-4">
            <p className="text-caption keep-all text-ink-sub">
              이 관찰이 지금의 너와 비슷해?
            </p>
            <div className="flex gap-2">
              <FeedbackButton
                label="맞는 것 같아"
                selected={feedback === 'ok'}
                onClick={() => {
                  setFeedback('ok');
                  trackEvent('profile_feedback_positive');
                  showToast('관찰 기록에 반영했어');
                }}
              />
              <FeedbackButton
                label="조금 달라"
                muted
                selected={feedback === 'no'}
                onClick={() => {
                  setFeedback('no');
                  trackEvent('profile_feedback_edit');
                  setEditOpen(true);
                }}
              />
            </div>
          </div>

          <NoticeBox>{PRIVACY.aiResult}</NoticeBox>
        </div>
      </ScreenLayout>

      <BottomSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="어디를 고칠까?"
        description="사진을 바꾸면 Observed Me만 다시 분석돼. 관계 성향·이전 경험을 바꾸면 동기화율과 Relationship Mirror도 함께 다시 계산돼."
      >
        <div className="flex flex-col gap-2">
          <FillDataRow
            label="사진 추가·수정"
            actionLabel="이동"
            onClick={() => {
              if (revisit) trackEvent('result_edit_entry', { section: 'photos' });
              router.push(editHref(ROUTES.photos));
            }}
          />
          <FillDataRow
            label="사진 관찰 다시 보기"
            actionLabel="이동"
            onClick={() => {
              if (revisit) trackEvent('result_edit_entry', { section: 'observed' });
              router.push(editHref(ROUTES.observed));
            }}
          />
          <FillDataRow
            label="관계 성향 답변 고치기"
            actionLabel="이동"
            onClick={() => {
              if (revisit) trackEvent('result_edit_entry', { section: 'declared' });
              router.push(editHref(ROUTES.declared(1)));
            }}
          />
          <FillDataRow
            label="이전 관계 경험 고치기"
            actionLabel="이동"
            onClick={() => {
              if (revisit) trackEvent('result_edit_entry', { section: 'experience' });
              router.push(editHref(ROUTES.past(1)));
            }}
          />
          {/*
            v1.46.3 — 생년월일은 **한 번 넣으면 다시 보이지 않는 값**이었다.
            입력 화면(`/lens/birth`)이 렌즈 목록 안쪽에 있어서, 오타를 고치거나
            음력으로 잘못 넣은 걸 바꾸려면 그 경로를 기억하고 있어야 했다.
            수정 허브에 현재 값과 함께 둔다 — 없으면 `입력 없음`이라고 말한다.

            ⚠️ 이 값은 동기화율·Mirror 판정에 들어가지 않는다(렌즈 전용).
            그래서 시트 설명의 '다시 계산돼' 문장에도 넣지 않았다.
          */}
          <FillDataRow
            label={`생년월일 · ${formatBirthSummary(answers.birthProfile)}`}
            actionLabel="이동"
            onClick={() => {
              if (revisit) trackEvent('result_edit_entry', { section: 'birth' });
              router.push(ROUTES.lensBirth);
            }}
          />
          <Button variant="secondary" className="mt-1.5" onClick={() => setEditOpen(false)}>
            그대로 둘게
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}

function FeedbackButton({
  label,
  selected,
  muted = false,
  onClick,
}: {
  label: string;
  selected: boolean;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'min-h-11 flex-1 rounded-[11px] border py-3 text-sub transition-colors duration-200',
        selected
          ? 'border-brand bg-brand-tint font-semibold text-ink'
          : cn('border-line bg-surface active:bg-sunken', muted ? 'text-ink-sub' : 'text-ink'),
      )}
    >
      {label}
    </button>
  );
}
