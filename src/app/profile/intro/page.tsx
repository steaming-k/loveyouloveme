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

/**
 * S06 AI Profile Building 인트로 — 3 Data Layer를 먼저 설명한다
 *
 * ⚠️ v1.47 UT-2 — **'샘플 답변으로 결과부터 볼게' 바로가기를 참가자 화면에서 뺐다.**
 * 두 가지 이유다:
 *   ① 메타 문구 — 참가자에게 제품이 샘플/체험판으로 읽힌다(UT-2 RC 금지 문구).
 *   ② 플로우 오염 — 누르면 입력 전 과정을 건너뛰고 미리 만들어 둔 세션의 결과를
 *     자기 결과처럼 보게 된다. UT에서 관찰하려는 것이 바로 그 입력 과정이다.
 * `loadSampleSession()` 자체는 그대로 있다 — dev 전용 `/dev/latency-session`과
 * `PrototypePanel`이 쓰고, 둘 다 production에서 렌더되지 않는다.
 */
export default function ProfileIntroPage() {
  const router = useRouter();

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
          <p className="text-center text-meta text-ink-muted">약 3분 · 중간에 저장돼</p>
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
          사진 + 몇 가지 질문 + 관계 경험을 바탕으로 러비가 너에 대한 관찰 기록을 만들어.
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
