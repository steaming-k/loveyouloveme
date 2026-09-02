'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/common/Button';
import { ChoiceChip } from '@/components/common/ChoiceChip';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { SegmentedField } from '@/components/common/SegmentedField';
import { InlineError, NoticeBox, PageHeading, Tag } from '@/components/common/primitives';
import { PRIVACY } from '@/data/copy';
import { MBTI_TYPES } from '@/data/mbti';
import { TARGET_FIELDS, TARGET_MIN_KNOWN, TARGET_RELATION_OPTIONS } from '@/data/targetFields';
import { trackEvent } from '@/lib/analytics';
import { ROUTES } from '@/lib/routes';
import { targetKnownCount } from '@/lib/validation';
import { useSession } from '@/state/SessionProvider';

/**
 * S19 상대 정보 입력
 * 모르는 항목은 '모름'으로 남길 수 있고, 그 항목은 동기화율에 반영하지 않는다.
 * 상대의 실제 마음이나 성격을 판정하지 않는다는 안내를 입력 지점에 둔다.
 *
 * 상대 MBTI는 이 4개 항목과 별개의 선택 입력이다 — 아는 항목 카운트(known/4)에도, 동기화율
 * 계산에도 들어가지 않는다. 내 MBTI(S13에서 입력)와 둘 다 있을 때만 참고용 MBTI Lens를 만든다.
 * '궁합 점수를 더 정확하게 만들기 위해 입력해달라'는 식의 문구는 쓰지 않는다.
 */
export default function TargetPage() {
  const router = useRouter();
  const { answers, setTargetRelation, setTargetLevel, setTargetMbti } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [mbtiOpen, setMbtiOpen] = useState(false);

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
          <span className="text-ink-faint">모름은 점수에서 제외돼</span>
        </div>

        <div className="flex flex-col gap-2.5 rounded-[16px] border border-line bg-surface p-4">
          <button
            type="button"
            onClick={() => setMbtiOpen((prev) => !prev)}
            aria-expanded={mbtiOpen}
            className="flex min-h-11 items-center justify-between gap-3 text-left"
          >
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-[10.5px] font-semibold tracking-[0.05em] text-ink-muted">
                PERSONALITY LENS · 선택
              </span>
              <span className="text-caption font-medium">상대 MBTI를 알고 있어?</span>
              <span className="text-[11.5px] keep-all text-ink-faint">
                점수에는 넣지 않지만, 둘 사이의 성향 차이를 보는 참고 렌즈로 사용할게.
              </span>
            </span>
            <Tag tone={answers.target.mbti ? 'brand' : 'neutral'}>
              {answers.target.mbti ?? (mbtiOpen ? '접기' : '펼치기')}
            </Tag>
          </button>

          {mbtiOpen ? (
            <div className="flex flex-wrap gap-2 pt-1" role="radiogroup" aria-label="상대 MBTI (선택)">
              {MBTI_TYPES.map((type) => (
                <ChoiceChip
                  key={type}
                  label={type}
                  selected={answers.target.mbti === type}
                  onToggle={() => setTargetMbti(answers.target.mbti === type ? null : type)}
                />
              ))}
              <ChoiceChip
                label="모름"
                selected={answers.target.mbti === null}
                onToggle={() => setTargetMbti(null)}
              />
            </div>
          ) : null}
        </div>

        <NoticeBox>{PRIVACY.target}</NoticeBox>

        <button
          type="button"
          onClick={() => router.push(ROUTES.lens)}
          className="flex min-h-11 items-center justify-between px-1 text-[12.5px] text-ink-faint"
        >
          <span>러비의 다른 관측 렌즈</span>
          <span className="text-ink-muted" aria-hidden>
            →
          </span>
        </button>
      </div>
    </ScreenLayout>
  );
}
