'use client';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/common/Button';
import { ChoiceChip } from '@/components/common/ChoiceChip';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { NoticeBox, PageHeading, SectionLabel, Tag } from '@/components/common/primitives';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { MBTI_LENS_COPY } from '@/data/copy';
import { MBTI_NOTES, MBTI_TYPES } from '@/data/mbti';
import { ROUTES } from '@/lib/routes';
import { useSession } from '@/state/SessionProvider';

/**
 * X1-a MBTI Lens — Add-on / Entertainment
 * 궁합 점수·Relationship Mirror 계산에는 관여하지 않는다. 유형을 고르면 대화 소재용
 * 한 줄 관찰과 질문 하나만 보여준다.
 */
export default function MbtiLensPage() {
  const router = useRouter();
  const { answers, setMbti } = useSession();

  const note = answers.mbti ? MBTI_NOTES[answers.mbti] : null;

  return (
    <ScreenLayout
      header={<ScreenHeader backHref={ROUTES.lens} action={<Tag tone="neutral">ADD-ON</Tag>} />}
      footer={<Button variant="secondary" onClick={() => router.push(ROUTES.lens)}>렌즈 목록으로</Button>}
      bodyClassName="pt-1.5 pb-4"
    >
      <div className="flex flex-col gap-5">
        <PageHeading lines={MBTI_LENS_COPY.title} caption={MBTI_LENS_COPY.caption} />

        <div className="flex flex-col gap-2.5">
          <SectionLabel>{MBTI_LENS_COPY.pickLabel}</SectionLabel>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="MBTI 유형">
            {MBTI_TYPES.map((type) => (
              <ChoiceChip
                key={type}
                label={type}
                selected={answers.mbti === type}
                onToggle={() => setMbti(answers.mbti === type ? null : type)}
              />
            ))}
          </div>
        </div>

        {note ? (
          <LovyMessage pose="book" size={56}>
            <p className="mb-2 font-medium">{note.trait}</p>
            <p className="text-ink-sub">{note.question}</p>
          </LovyMessage>
        ) : (
          <NoticeBox>{MBTI_LENS_COPY.emptyNotice}</NoticeBox>
        )}

        <NoticeBox>재미로 보는 참고용 렌즈예요. 궁합 점수·Relationship Mirror에는 반영하지 않아요.</NoticeBox>
      </div>
    </ScreenLayout>
  );
}
