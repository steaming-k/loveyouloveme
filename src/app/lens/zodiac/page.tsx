'use client';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/common/Button';
import { ChoiceChip } from '@/components/common/ChoiceChip';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { NoticeBox, PageHeading, SectionLabel, Tag } from '@/components/common/primitives';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { ZODIAC_LENS_COPY } from '@/data/copy';
import { ZODIAC_NOTES, ZODIAC_SIGNS } from '@/data/zodiac';
import { ROUTES } from '@/lib/routes';
import { useSession } from '@/state/SessionProvider';

/**
 * X1-b Astrology Lens — Add-on / Entertainment
 * 궁합 점수·Relationship Mirror 계산에는 관여하지 않는다. 생년월일 → 별자리 변환 로직 대신
 * 대부분 이미 알고 있는 자기 별자리를 직접 고르게 한다(MBTI Lens와 같은 방식).
 */
export default function ZodiacLensPage() {
  const router = useRouter();
  const { answers, setZodiac } = useSession();

  const note = answers.zodiac ? ZODIAC_NOTES[answers.zodiac] : null;

  return (
    <ScreenLayout
      header={<ScreenHeader backHref={ROUTES.lens} action={<Tag tone="neutral">ADD-ON</Tag>} />}
      footer={<Button variant="secondary" onClick={() => router.push(ROUTES.lens)}>렌즈 목록으로</Button>}
      bodyClassName="pt-1.5 pb-4"
    >
      <div className="flex flex-col gap-5">
        <PageHeading lines={ZODIAC_LENS_COPY.title} caption={ZODIAC_LENS_COPY.caption} />

        <div className="flex flex-col gap-2.5">
          <SectionLabel>{ZODIAC_LENS_COPY.pickLabel}</SectionLabel>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="별자리">
            {ZODIAC_SIGNS.map((sign) => (
              <ChoiceChip
                key={sign}
                label={ZODIAC_NOTES[sign].label}
                selected={answers.zodiac === sign}
                onToggle={() => setZodiac(answers.zodiac === sign ? null : sign)}
              />
            ))}
          </div>
        </div>

        {note ? (
          <LovyMessage pose="crystal" size={56}>
            <p className="mb-2 font-medium">{note.trait}</p>
            <p className="text-ink-sub">{note.question}</p>
          </LovyMessage>
        ) : (
          <NoticeBox>{ZODIAC_LENS_COPY.emptyNotice}</NoticeBox>
        )}

        <NoticeBox>재미로 보는 참고용 렌즈예요. 궁합 점수·Relationship Mirror에는 반영하지 않아요.</NoticeBox>
      </div>
    </ScreenLayout>
  );
}
