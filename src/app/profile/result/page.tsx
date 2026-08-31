'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

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
  return (
    <HydrationGate>
      <ProfileResultView />
    </HydrationGate>
  );
}

function ProfileResultView() {
  const router = useRouter();
  const { showToast } = useToast();
  const { answers, markComplete } = useSession();
  const profile = useRelationshipProfile();

  const [feedback, setFeedback] = useState<'ok' | 'no' | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const ready = canBuildProfile(answers);

  useEffect(() => {
    if (!ready) return;
    markComplete('profile');
    trackEvent('profile_complete', {
      confidence: profile.confidence,
      observed_items: profile.layers[0]?.items.length ?? 0,
    });
  }, [ready, markComplete, profile.confidence, profile.layers]);

  if (!ready) {
    return (
      <ScreenLayout
        header={<ScreenHeader backHref={ROUTES.pastIntro} title="관찰 기록" />}
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
            backHref={ROUTES.past(3)}
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
          <div className="flex flex-col gap-0.5">
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
          </div>
        }
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

          <ProfileLayerStack layers={profile.layers} coreInsight={profile.coreInsight} />

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
                  showToast('관찰 기록에 반영했어요');
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
        description="바꾸면 동기화율과 Relationship Mirror도 함께 다시 계산돼요."
      >
        <div className="flex flex-col gap-2">
          <FillDataRow
            label="사진 관찰 다시 보기"
            actionLabel="이동"
            onClick={() => router.push(ROUTES.observed)}
          />
          <FillDataRow
            label="관계 성향 답변 고치기"
            actionLabel="이동"
            onClick={() => router.push(ROUTES.declared(1))}
          />
          <FillDataRow
            label="이전 관계 경험 고치기"
            actionLabel="이동"
            onClick={() => router.push(ROUTES.past(1))}
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
