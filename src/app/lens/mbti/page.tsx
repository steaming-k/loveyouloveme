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
 * X1-a MBTI Lens — Add-on
 * 다른 Add-on 렌즈와 달리 궁합 점수 계산에 실제로 관여한다: 이 화면에서 고른 내 MBTI와
 * /target(S19)에서 넣는 상대 MBTI를 둘 다 입력하면 동기화율에 추가 축으로 반영된다
 * (lib/logic/compatibility.ts buildMbtiDimension). 유형을 고르면 그 외에 대화 소재용
 * 한 줄 관찰과 질문 하나도 보여준다.
 */
export default function MbtiLensPage() {
  const router = useRouter();
  const { answers, setMbti } = useSession();

  const note = answers.mbti ? MBTI_NOTES[answers.mbti] : null;
  const bothSet = Boolean(answers.mbti && answers.target.mbti);

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

        <NoticeBox>
          {bothSet
            ? `상대 MBTI(${answers.target.mbti})도 입력돼 있어서 동기화율에 소폭 반영됐어요. 성향 궁합 이론이 아니라 겹치는 글자 수만 보는 참고용 지표예요.`
            : '상대 MBTI까지 입력하면 동기화율에 소폭 반영돼요. 그전까진 이 화면만으로는 점수에 영향이 없어요.'}
        </NoticeBox>
      </div>
    </ScreenLayout>
  );
}
