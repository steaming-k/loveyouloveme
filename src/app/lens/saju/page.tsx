'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/common/Button';
import { HydrationGate } from '@/components/common/HydrationGate';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { PageHeading, SectionLabel, Tag } from '@/components/common/primitives';
import {
  BirthMissingBlock,
  BirthSummaryRows,
  ConversationPromptList,
  EntertainmentNotice,
  LimitationList,
} from '@/components/lens/LensStateBlocks';
import { Lovy } from '@/components/lovy/Lovy';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { SAJU_COPY } from '@/data/copy';
import { trackEvent } from '@/lib/analytics';
import { lensAvailability } from '@/lib/logic/birth';
import { ROUTES } from '@/lib/routes';
import {
  calculateSaju,
  calculateSajuCompatibility,
  sajuEngineAvailable,
} from '@/services/sajuService';
import { useSession } from '@/state/SessionProvider';

/**
 * X1-c 사주 Lens — Entertainment
 *
 * ⚠️ 이 화면은 **사주 명식을 계산하지 않는다.** 검증된 계산 엔진이 없는 동안은
 * `sajuService`가 `available: false`를 돌려주고, 화면은 그 상태를 정직하게 보여준다 —
 * 없는 결과를 그럴듯하게 채워 넣지 않는다.
 *
 * 엔진이 붙으면(`NEXT_PUBLIC_SAJU_ENGINE_READY=true`) 이 화면 코드는 그대로 두고
 * 서비스 구현만 교체하면 된다.
 */
export default function SajuLensPage() {
  return (
    <HydrationGate>
      <SajuLensView />
    </HydrationGate>
  );
}

function SajuLensView() {
  const router = useRouter();
  const { answers } = useSession();
  const [today] = useState(() => new Date());

  const mine = answers.birthProfile;
  const theirs = answers.target.birthProfile;
  const availability = lensAvailability(mine, theirs, today);

  const self = useMemo(() => calculateSaju(mine, today), [mine, today]);
  const couple = useMemo(
    () => calculateSajuCompatibility(mine, theirs, today),
    [mine, theirs, today],
  );

  useEffect(() => {
    trackEvent('saju_lens_view', {
      mode: availability.couple ? 'compatibility' : 'self',
      engine_available: sajuEngineAvailable,
    });
  }, [availability.couple]);

  const showEngineNotice = availability.self && !sajuEngineAvailable;

  return (
    <ScreenLayout
      header={
        <ScreenHeader backHref={ROUTES.lens} action={<Tag tone="neutral">{SAJU_COPY.badge}</Tag>} />
      }
      footer={
        <Button variant="secondary" onClick={() => router.push(ROUTES.lens)}>
          렌즈 목록으로
        </Button>
      }
      bodyClassName="pt-1.5 pb-4"
    >
      <div className="flex flex-col gap-5">
        <PageHeading lines={SAJU_COPY.title} caption={SAJU_COPY.caption} />

        {!availability.self ? (
          <BirthMissingBlock lens="saju" missing={availability.missing === 'both' ? 'both' : 'self'} />
        ) : null}

        {/*
          엔진이 없을 때의 정직한 상태. 명식·해석 대신 '무엇이 왜 안 되는지'와
          '연결되면 무엇을 제공할지'를 보여준다.
        */}
        {showEngineNotice ? (
          <section className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line-strong bg-canvas-warm px-4 py-6 text-center">
            <Lovy pose="book" size={92} decorative />
            <h2 className="text-section keep-all">{SAJU_COPY.engineOffTitle}</h2>
            <p className="text-caption keep-all leading-relaxed text-ink-sub">
              {SAJU_COPY.engineOffBody}
            </p>
            <span className="rounded-tag bg-chip px-2.5 py-1.5 text-[11px] font-semibold text-ink-muted">
              DEMO · 계산 엔진 미연결
            </span>
          </section>
        ) : null}

        {/* 엔진이 붙으면 이 자리에 명식·해석이 들어온다 */}
        {self.available && self.interpretation ? (
          <section className="flex flex-col gap-2.5">
            <SectionLabel>전통 해석에서 보는 주요 성향</SectionLabel>
            <ul className="flex flex-col gap-2">
              {self.interpretation.traits.map((trait) => (
                <li
                  key={trait}
                  className="rounded-row border border-line bg-surface px-3.5 py-3 text-caption keep-all leading-relaxed"
                >
                  {trait}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {couple.available && couple.observations.length > 0 ? (
          <section className="flex flex-col gap-2.5">
            <SectionLabel>전통 해석으로 본 우리 둘</SectionLabel>
            <ul className="flex flex-col gap-2">
              {couple.observations.map((observation) => (
                <li
                  key={`${observation.kind}-${observation.label}`}
                  className="flex flex-col gap-1.5 rounded-card border border-line bg-surface p-4"
                >
                  <p
                    className={
                      observation.kind === 'similar'
                        ? 'text-[10px] font-semibold tracking-[0.06em] text-mint-text'
                        : 'text-[10px] font-semibold tracking-[0.06em] text-ink-muted'
                    }
                  >
                    {observation.kind === 'similar'
                      ? '비슷하게 읽히는 부분'
                      : '다르게 읽힐 수 있는 부분'}
                  </p>
                  <p className="text-caption font-medium">{observation.label}</p>
                  <p className="text-[12.5px] keep-all leading-relaxed text-[#555]">
                    {observation.text}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <ConversationPromptList lens="saju" prompts={couple.prompts} />

        {/* 상대 정보만 없으면 알려준다 */}
        {availability.self && !availability.couple ? (
          <BirthMissingBlock lens="saju" missing="target" />
        ) : null}

        <BirthSummaryRows mine={mine} theirs={theirs} />

        <LimitationList items={availability.couple ? couple.limitations : self.limitations} />

        <LovyMessage pose="book" size={52}>
          {SAJU_COPY.notPrediction}
        </LovyMessage>

        <EntertainmentNotice>
          재미로 보는 참고 렌즈예요. 동기화율·Relationship Mirror·관찰 기록에는 반영하지 않아요.
        </EntertainmentNotice>
      </div>
    </ScreenLayout>
  );
}
