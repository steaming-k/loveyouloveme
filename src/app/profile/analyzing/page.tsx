'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/common/Button';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { LovyLoading } from '@/components/lovy/LovyLoading';
import { AiFailureView } from '@/components/profile/AiFailureView';
import { OBSERVED_LOADING } from '@/data/copy';
import { trackEvent } from '@/lib/analytics';
import { ROUTES } from '@/lib/routes';
import { analyzeObservedProfile } from '@/services/aiService';
import { useSession } from '@/state/SessionProvider';
import type { AiFailureReason } from '@/types';

/**
 * S08 Observed Me 로딩
 *
 * ⚠️ v1.6에서 동작이 바뀌었다(§74). 예전에는 애니메이션 4줄이 끝나면 **분석 결과와 무관하게**
 * 다음 화면으로 넘어갔다 — 실제 API를 붙이면 결과보다 먼저 이동해버린다.
 *
 * 이제 두 조건을 **둘 다** 만족해야 이동한다:
 *   ① 최소 연출 시간(로그 시퀀스)  ② 실제 분석 완료
 * API가 느려도 로그를 반복 재생하지 않고, 마지막 상태에서 기다린다.
 *
 * ?error=1 로 진입하면 실패 상태(E2)를 그대로 확인할 수 있다.
 */
export default function ObservedLoadingPage() {
  const router = useRouter();
  const { answers, setObservedAnalysis } = useSession();

  const [failure, setFailure] = useState<AiFailureReason | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  /** 분석이 끝났는지 — 연출 완료와 별개로 추적한다 */
  const analysisDone = useRef(false);
  const sequenceDone = useRef(false);
  /** StrictMode 이중 호출·리렌더로 요청이 두 번 나가지 않게 막는다(§78) */
  const requested = useRef<string | null>(null);

  const goNext = useCallback(() => {
    if (analysisDone.current && sequenceDone.current) router.replace(ROUTES.observed);
  }, [router]);

  useEffect(() => {
    const key = `${retryCount}:${answers.photos.map((photo) => photo.id).join(',')}`;
    if (requested.current === key) return;
    requested.current = key;

    let cancelled = false;
    analysisDone.current = false;
    setFailure(null);

    const run = async () => {
      try {
        const shouldFail = new URLSearchParams(window.location.search).get('error') === '1';
        if (shouldFail) {
          if (!cancelled) setFailure('NETWORK_ERROR');
          return;
        }

        const result = await analyzeObservedProfile(answers.photos);
        if (cancelled) return;

        if (!result.ok) {
          setFailure(result.reason);
          return;
        }

        // fallback으로 내려온 결과는 저장하되 화면이 그 사실을 표시한다(§39).
        if (result.data.meta.mode === 'fallback') {
          trackEvent('ai_fallback_used', { task: 'observed-profile', reason: result.fallbackReason ?? 'unknown' });
        }

        setObservedAnalysis(result.data);
        analysisDone.current = true;
        goNext();
      } catch {
        if (!cancelled) setFailure('SERVER_ERROR');
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [answers.photos, retryCount, setObservedAnalysis, goNext]);

  const handleSequenceComplete = useCallback(() => {
    sequenceDone.current = true;
    goNext();
  }, [goNext]);

  if (failure) {
    return (
      <ScreenLayout
        footer={
          <div className="flex flex-col gap-0.5">
            <Button
              // pending 중 재요청 난사를 막는다(§35)
              onClick={() => {
                sequenceDone.current = false;
                setRetryCount((count) => count + 1);
              }}
            >
              다시 분석
            </Button>
            <Button variant="text" onClick={() => router.push(ROUTES.photos)}>
              사진 다시 고르기
            </Button>
            <Button variant="text" onClick={() => router.push(ROUTES.declared(1))}>
              질문으로 계속하기
            </Button>
          </div>
        }
      >
        {/* 사진 분석 실패가 Core Funnel을 막지 않는다(§63) — 질문으로 계속할 길을 함께 준다 */}
        <AiFailureView reason={failure} retryCount={retryCount} />
      </ScreenLayout>
    );
  }

  return (
    <LovyLoading
      pose="chart"
      size={180}
      lines={OBSERVED_LOADING}
      onComplete={handleSequenceComplete}
      footerNote={`선택한 사진 ${answers.photos.length}장만 관찰 중`}
      indicator="bar"
    />
  );
}
