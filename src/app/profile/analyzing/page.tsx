'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/common/Button';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { LovyObservation } from '@/components/lovy/LovyObservation';
import { AiFailureView } from '@/components/profile/AiFailureView';
import { OBSERVATION_CAVEAT, OBSERVED_OBSERVATION } from '@/data/copy';
import { trackEvent } from '@/lib/analytics';
import { resolveReturnDestination, withReturnTo } from '@/lib/returnTo';
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
  // v1.16 — Photo Revisit(§27)에서 들어온 `from`을 잃지 않도록 View가 useSearchParams()를 쓴다.
  return (
    <Suspense fallback={null}>
      <ObservedLoadingView />
    </Suspense>
  );
}

function ObservedLoadingView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { answers, setObservedAnalysis } = useSession();

  const [failure, setFailure] = useState<AiFailureReason | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  /** 분석이 끝났는지 — 연출 완료와 별개로 추적한다 */
  const analysisDone = useRef(false);
  const sequenceDone = useRef(false);
  /**
   * 이미 시작한 요청 key. **요청을 막는 용도가 아니다.**
   *
   * ⚠️ v1.10 수정 — 예전에는 `if (requested.current === key) return;`으로 effect 자체를
   * 건너뛰었다. 그런데 StrictMode는 mount → cleanup → mount를 연달아 실행하므로,
   * 첫 mount의 cleanup이 `cancelled = true`를 세팅한 뒤 두 번째 mount가 이 가드에 걸려
   * **아무 실행도 남지 않았다.** 그래서 분석은 성공(200)했는데 로딩 화면에서 영영 멈췄다.
   *
   * 이제는 두 mount 모두 `run()`을 돌린다 — 중복 네트워크 요청은 `aiClient`가 이미
   * in-flight 병합 + 캐시로 막는다(§78). 이 ref는 Analytics를 한 번만 보내기 위한 것이다.
   */
  const startedKey = useRef<string | null>(null);
  const completedKey = useRef<string | null>(null);

  const goNext = useCallback(() => {
    if (analysisDone.current && sequenceDone.current) {
      router.replace(withReturnTo(ROUTES.observed, searchParams));
    }
  }, [router, searchParams]);

  useEffect(() => {
    const key = `${retryCount}:${answers.photos.map((photo) => photo.id).join(',')}`;

    let cancelled = false;
    analysisDone.current = false;
    setFailure(null);

    /** 같은 key에서 이벤트를 한 번만 보낸다 (StrictMode 이중 mount·리렌더 대비) */
    const trackOncePerKey = (ref: typeof startedKey, send: () => void) => {
      if (ref.current === key) return;
      ref.current = key;
      send();
    };

    const run = async () => {
      const startedAt = Date.now();
      const photoCount = answers.photos.length;
      // §22 — 업로드 이후 단계를 각각 센다. 사진 기능의 성공을 업로드율 하나로 보지 않는다.
      trackOncePerKey(startedKey, () =>
        trackEvent('photo_analysis_start', { photo_count: photoCount }),
      );

      try {
        const shouldFail = new URLSearchParams(window.location.search).get('error') === '1';
        if (shouldFail) {
          if (!cancelled) setFailure('NETWORK_ERROR');
          trackOncePerKey(completedKey, () =>
            trackEvent('photo_analysis_fail', {
              photo_count: photoCount,
              reason: 'NETWORK_ERROR',
              duration_ms: Date.now() - startedAt,
            }),
          );
          return;
        }

        const result = await analyzeObservedProfile(answers.photos);
        if (cancelled) return;

        if (!result.ok) {
          setFailure(result.reason);
          trackOncePerKey(completedKey, () =>
            trackEvent('photo_analysis_fail', {
              photo_count: photoCount,
              reason: result.reason,
              duration_ms: Date.now() - startedAt,
            }),
          );
          return;
        }

        // fallback으로 내려온 결과는 저장하되 화면이 그 사실을 표시한다(§39).
        if (result.data.meta.mode === 'fallback') {
          trackEvent('ai_fallback_used', { task: 'observed-profile', reason: result.fallbackReason ?? 'unknown' });
        }

        const observationCount = result.data.traits.length;
        const repeatedCount = result.data.traits.filter(
          (trait) => trait.signal && trait.signal.strength !== 'single',
        ).length;

        // ⚠️ 관찰 문장·사진 설명은 절대 property에 넣지 않는다(§22). 개수와 모드만 보낸다.
        const shared = {
          photo_count: photoCount,
          observation_count: observationCount,
          repeated_signal_count: repeatedCount,
          ai_mode: result.data.meta.mode,
          observed_state: result.data.observedState ?? 'unknown',
          duration_ms: Date.now() - startedAt,
        };

        trackOncePerKey(completedKey, () => {
          trackEvent('photo_analysis_complete', shared);
          if (observationCount > 0) trackEvent('photo_observation_generated', shared);
          if (repeatedCount > 0) trackEvent('photo_repeated_signal_generated', shared);
        });

        setObservedAnalysis(result.data);
        analysisDone.current = true;
        goNext();
      } catch {
        if (!cancelled) setFailure('SERVER_ERROR');
        trackOncePerKey(completedKey, () =>
          trackEvent('photo_analysis_fail', {
            photo_count: photoCount,
            reason: 'SERVER_ERROR',
            duration_ms: Date.now() - startedAt,
          }),
        );
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
            <Button
              variant="text"
              onClick={() => router.push(withReturnTo(ROUTES.photos, searchParams))}
            >
              사진 다시 고르기
            </Button>
            <Button
              variant="text"
              onClick={() => router.push(resolveReturnDestination(searchParams, ROUTES.declared(1)))}
            >
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
    <LovyObservation
      pose="chart"
      size={86}
      stages={OBSERVED_OBSERVATION}
      /* 사진에서 실제로 보는 것만 적는다 — 성격·관계를 관찰한다고 말하지 않는다(§6/§14) */
      tokens={['장면', '활동', '겹치는 신호']}
      caveat={OBSERVATION_CAVEAT.observed}
      onComplete={handleSequenceComplete}
      footerNote={`선택한 사진 ${answers.photos.length}장만 관찰 중`}
    />
  );
}
