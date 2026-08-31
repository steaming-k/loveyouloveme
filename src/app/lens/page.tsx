'use client';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { PageHeading, Tag } from '@/components/common/primitives';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { LENS_COPY, LOVY_LINES } from '@/data/copy';
import { ZODIAC_NOTES } from '@/data/zodiac';
import { ROUTES } from '@/lib/routes';
import { useSession } from '@/state/SessionProvider';

/**
 * X1 러비의 다른 관측 렌즈
 * MBTI는 Supporting Lens, 사주·Astrology는 Entertainment Lens로 위계를 구분한다.
 * 어느 렌즈도 동기화율 계산에 관여하지 않는다.
 */
export default function LensPage() {
  const router = useRouter();
  const { answers } = useSession();

  /** 각 렌즈의 현재 상태를 뱃지로 보여준다. 렌즈가 늘어나면 이 매핑만 추가하면 된다. */
  const valueByHref: Record<string, string | null> = {
    // MBTI는 두 유형이 모두 있을 때 비교가 되므로 그 상태까지 구분해서 보여준다.
    [ROUTES.lensMbti]:
      answers.mbti && answers.target.mbti
        ? `${answers.mbti} × ${answers.target.mbti}`
        : (answers.mbti ?? answers.target.mbti),
    [ROUTES.lensZodiac]: answers.zodiac ? ZODIAC_NOTES[answers.zodiac].label : null,
  };

  return (
    <ScreenLayout
      header={
        <ScreenHeader backHref={ROUTES.target} action={<Tag tone="neutral">{LENS_COPY.badge}</Tag>} />
      }
      footer={<Button variant="secondary" onClick={() => router.back()}>돌아가기</Button>}
      bodyClassName="pt-1.5 pb-4"
    >
      <div className="flex flex-col gap-4">
        <PageHeading lines={[LENS_COPY.title]} caption={LENS_COPY.caption} />

        <ul className="flex flex-col gap-2.5">
          {LENS_COPY.items.map((item) =>
            item.ready && item.href ? (
              <li key={item.title}>
                <button
                  type="button"
                  onClick={() => router.push(item.href)}
                  className="flex w-full items-center justify-between gap-3 rounded-row border border-line bg-surface p-4 text-left active:bg-sunken"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
                      {item.group}
                    </p>
                    <h3 className="text-[14.5px] font-medium">{item.title}</h3>
                    <p className="text-[12.5px] keep-all text-ink-sub">{item.caption}</p>
                  </div>
                  <Tag tone={valueByHref[item.href] ? 'brand' : 'neutral'}>
                    {valueByHref[item.href] ?? '보기 →'}
                  </Tag>
                </button>
              </li>
            ) : (
              <li
                key={item.title}
                className="flex items-center justify-between gap-3 rounded-row border border-line bg-surface p-4"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
                    {item.group}
                  </p>
                  <h3 className="text-[14.5px] font-medium">{item.title}</h3>
                  <p className="text-[12.5px] keep-all text-ink-sub">{item.caption}</p>
                </div>
                <Tag tone="neutral">준비 중</Tag>
              </li>
            ),
          )}
        </ul>

        <LovyMessage pose="movie" size={60}>
          {LOVY_LINES.lens}
        </LovyMessage>
      </div>
    </ScreenLayout>
  );
}
