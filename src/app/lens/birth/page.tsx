'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { Button } from '@/components/common/Button';
import { HydrationGate } from '@/components/common/HydrationGate';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { useToast } from '@/components/common/ToastProvider';
import { NoticeBox, PageHeading, SectionLabel, Tag } from '@/components/common/primitives';
import { BirthProfileForm } from '@/components/lens/BirthProfileForm';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { BIRTH_COPY } from '@/data/copy';
import { trackEvent } from '@/lib/analytics';
import { hasAnyBirthInput, isBirthDateUsable } from '@/lib/logic/birth';
import { ROUTES } from '@/lib/routes';
import { useSession } from '@/state/SessionProvider';

/**
 * X2 Birth Profile — 사주 · Astrology **공용** 출생정보 입력
 *
 * Main Funnel(프로필 빌딩)의 필수 질문이 아니다. CORE 분석에 필요하지 않은 정보로 전체 입력
 * 부담을 늘리지 않기 위해, Lens Context에서만 수집한다.
 *
 * 같은 정보를 사주에서 또, 별자리에서 또 묻지 않는다 — 여기서 한 번 받아 두 렌즈가 재사용한다.
 */
export default function BirthProfilePage() {
  return (
    <HydrationGate>
      <Suspense fallback={null}>
        <BirthProfileView />
      </Suspense>
    </HydrationGate>
  );
}

function BirthProfileView() {
  const router = useRouter();
  const params = useSearchParams();
  const { showToast } = useToast();
  const { answers, setBirthProfile, clearBirthProfile } = useSession();

  // 어느 렌즈에서 넘어왔는지 — 저장 후 그 렌즈로 돌려보낸다.
  const from = params.get('from');
  const backHref =
    from === 'saju' ? ROUTES.lensSaju : from === 'astrology' ? ROUTES.lensAstrology : ROUTES.lens;

  // 시간·날짜는 로직 파일이 아니라 화면에서 주입한다(순수 함수는 시간을 모른다).
  const [today] = useState(() => new Date());
  const [targetOpen, setTargetOpen] = useState(() => hasAnyBirthInput(answers.target.birthProfile));

  const selfReady = isBirthDateUsable(answers.birthProfile, today);
  const targetReady = isBirthDateUsable(answers.target.birthProfile, today);

  const handleDone = () => {
    if (selfReady) trackEvent('birth_profile_complete', { subject: 'self' });
    if (targetReady) trackEvent('birth_profile_complete', { subject: 'target' });
    router.push(backHref);
  };

  return (
    <ScreenLayout
      header={
        <ScreenHeader backHref={backHref} action={<Tag tone="neutral">{BIRTH_COPY.badge}</Tag>} />
      }
      footer={<Button onClick={handleDone}>{selfReady || targetReady ? '이 정보로 볼게' : '돌아가기'}</Button>}
      bodyClassName="pt-1.5 pb-4"
    >
      <div className="flex flex-col gap-5">
        <PageHeading lines={BIRTH_COPY.title} caption={BIRTH_COPY.caption} />

        <LovyMessage pose="crystal" size={52}>
          {BIRTH_COPY.lovyIntro}
        </LovyMessage>

        {/* 나 */}
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2 px-1">
            <SectionLabel className="px-0">{BIRTH_COPY.selfLabel}</SectionLabel>
            {hasAnyBirthInput(answers.birthProfile) ? (
              <button
                type="button"
                onClick={() => {
                  clearBirthProfile('self');
                  showToast('내 출생정보를 삭제했어');
                }}
                className="flex min-h-11 items-center text-meta text-ink-faint"
              >
                {BIRTH_COPY.clearSelf}
              </button>
            ) : null}
          </div>
          <BirthProfileForm
            profile={answers.birthProfile}
            onChange={(patch) => setBirthProfile('self', patch)}
            today={today}
            idPrefix="birth-self"
          />
        </section>

        {/* 상대 — 접이식. 사용자가 알고 있는 만큼만 */}
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2 px-1">
            <SectionLabel className="px-0">{BIRTH_COPY.targetLabel}</SectionLabel>
            {hasAnyBirthInput(answers.target.birthProfile) ? (
              <button
                type="button"
                onClick={() => {
                  clearBirthProfile('target');
                  showToast('상대 출생정보를 삭제했어');
                }}
                className="flex min-h-11 items-center text-meta text-ink-faint"
              >
                {BIRTH_COPY.clearTarget}
              </button>
            ) : null}
          </div>

          {targetOpen ? (
            <BirthProfileForm
              profile={answers.target.birthProfile}
              onChange={(patch) => setBirthProfile('target', patch)}
              today={today}
              idPrefix="birth-target"
              hint={BIRTH_COPY.targetHint}
            />
          ) : (
            <Button variant="secondary" onClick={() => setTargetOpen(true)}>
              상대 출생정보도 입력하기
            </Button>
          )}
        </section>

        <NoticeBox>{BIRTH_COPY.privacy}</NoticeBox>
      </div>
    </ScreenLayout>
  );
}
