'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/common/Button';
import { ChoiceChip } from '@/components/common/ChoiceChip';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { SegmentedField } from '@/components/common/SegmentedField';
import { InlineError, NoticeBox, PageHeading } from '@/components/common/primitives';
import { PRIVACY } from '@/data/copy';
import { TARGET_FIELDS, TARGET_MIN_KNOWN, TARGET_RELATION_OPTIONS } from '@/data/targetFields';
import { trackEvent } from '@/lib/analytics';
import { ROUTES } from '@/lib/routes';
import { targetKnownCount } from '@/lib/validation';
import { useSession } from '@/state/SessionProvider';

/**
 * S19 상대 정보 입력
 * 모르는 항목은 '모름'으로 남길 수 있고, 그 항목은 동기화율에 반영하지 않는다.
 * 상대의 실제 마음이나 성격을 판정하지 않는다는 안내를 입력 지점에 둔다.
 */
export default function TargetPage() {
  const router = useRouter();
  const { answers, setTargetRelation, setTargetLevel } = useSession();
  const [error, setError] = useState<string | null>(null);

  const known = targetKnownCount(answers.target);

  const handleNext = () => {
    if (known === 0) {
      setError('아는 항목 하나라도 알려줘. 그거라도 있으면 비교해볼게.');
      return;
    }
    trackEvent('target_profile_complete', {
      relation: answers.target.relation ?? '',
      known_count: known,
    });
    router.push(ROUTES.compatibilityAnalyzing);
  };

  return (
    <ScreenLayout
      header={<ScreenHeader backHref={ROUTES.profileResult} progress={88} />}
      footer={
        <div className="flex flex-col gap-2">
          {error ? <InlineError message={error} /> : null}
          {!error && known > 0 && known < TARGET_MIN_KNOWN ? (
            <p className="px-1 text-meta text-ink-muted">
              {TARGET_MIN_KNOWN - known}개 더 알려주면 동기화율을 계산할 수 있어
            </p>
          ) : null}
          <Button onClick={handleNext}>궁합 관찰하기</Button>
        </div>
      }
      bodyClassName="pt-2 pb-3"
    >
      <div className="flex flex-col gap-5">
        <PageHeading
          lines={['이번엔 그 지구인을 알려줘.']}
          caption="네가 아는 만큼만 골라도 돼. 모르는 건 비워둬."
        />

        <div className="flex flex-col gap-2.5">
          <p className="px-1 text-caption font-semibold text-[#555]">이 사람과 나는</p>
          <div className="flex flex-wrap gap-[7px]" role="radiogroup" aria-label="상대와의 관계">
            {TARGET_RELATION_OPTIONS.map((option) => (
              <ChoiceChip
                key={option.value}
                label={option.label}
                selected={answers.target.relation === option.value}
                onToggle={() => setTargetRelation(option.value)}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3.5 rounded-[16px] border border-line bg-surface p-4">
          {TARGET_FIELDS.map((field) => (
            <SegmentedField
              key={field.key}
              name={`target-${field.key}`}
              label={field.label}
              options={field.options}
              value={answers.target[field.key]}
              onChange={(value) => {
                setTargetLevel(field.key, value);
                setError(null);
              }}
            />
          ))}
        </div>

        <div className="flex items-center justify-between px-1 text-meta text-ink-muted">
          <span>
            아는 항목 <span className="font-semibold text-ink">{known}</span> / {TARGET_FIELDS.length}
          </span>
          <span className="text-ink-faint">모름은 점수에서 제외돼요</span>
        </div>

        <NoticeBox>{PRIVACY.target}</NoticeBox>

        <button
          type="button"
          onClick={() => router.push(ROUTES.lens)}
          className="flex min-h-11 items-center justify-between px-1 text-[12.5px] text-ink-faint"
        >
          <span>MBTI · 사주 · 별자리 렌즈</span>
          <span className="text-ink-muted" aria-hidden>
            →
          </span>
        </button>
      </div>
    </ScreenLayout>
  );
}
