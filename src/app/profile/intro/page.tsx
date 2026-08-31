'use client';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { NoticeBox } from '@/components/common/primitives';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { DATA_LAYERS, LOVY_LINES, PRIVACY } from '@/data/copy';
import { trackEvent } from '@/lib/analytics';
import { ROUTES } from '@/lib/routes';
import { useSession } from '@/state/SessionProvider';

/** S06 AI Profile Building 인트로 — 3 Data Layer를 먼저 설명한다 */
export default function ProfileIntroPage() {
  const router = useRouter();
  const { loadSampleSession } = useSession();

  return (
    <ScreenLayout
      header={<ScreenHeader backHref={ROUTES.status} progress={14} />}
      footer={
        <div className="flex flex-col gap-1.5">
          <Button
            onClick={() => {
              trackEvent('profile_building_start');
              router.push(ROUTES.photos);
            }}
          >
            관찰 시작
          </Button>
          <p className="text-center text-meta text-ink-muted">약 3분 · 중간에 저장돼요</p>
          <Button
            variant="text"
            onClick={() => {
              loadSampleSession();
              router.push(ROUTES.profileResult);
            }}
          >
            샘플 답변으로 결과부터 볼게
          </Button>
        </div>
      }
      bodyClassName="pt-1.5 pb-3"
    >
      <div className="flex flex-col gap-5">
        <LovyMessage pose="record" size={52} tone="lead">
          {LOVY_LINES.profileIntro.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </LovyMessage>

        <p className="px-1 text-caption leading-relaxed keep-all text-ink-sub">
          사진 + 몇 가지 질문 + 관계 경험을 바탕으로 러비가 너에 대한 관찰 기록을 만들어요.
        </p>

        <ol className="flex flex-col px-0.5">
          {DATA_LAYERS.map((layer, index) => (
            <li key={layer.n} className="flex gap-3.5">
              <div className="flex w-[26px] flex-none flex-col items-center">
                <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-brand text-meta font-semibold text-white">
                  {layer.n}
                </span>
                {index < DATA_LAYERS.length - 1 ? (
                  <span className="my-1 w-px flex-1 bg-rule" aria-hidden />
                ) : null}
              </div>

              <div className={index < DATA_LAYERS.length - 1 ? 'pb-[18px]' : undefined}>
                <p className="text-body font-semibold tracking-[-0.2px]">{layer.title}</p>
                <p className="mt-1 text-caption leading-snug keep-all text-ink-sub">
                  {layer.caption}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <NoticeBox>{PRIVACY.profileIntro}</NoticeBox>
      </div>
    </ScreenLayout>
  );
}
