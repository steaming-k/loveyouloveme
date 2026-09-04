'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/common/Button';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { ErrorStateView } from '@/components/common/StateScreens';
import { LovyObservation } from '@/components/lovy/LovyObservation';
import { AXIS_DEFINITIONS } from '@/data/axes';
import { COMPATIBILITY_OBSERVATION, OBSERVATION_CAVEAT } from '@/data/copy';
import { trackEvent } from '@/lib/analytics';
import { ROUTES } from '@/lib/routes';
import { calculateCompatibility } from '@/services/aiService';
import { useSession } from '@/state/SessionProvider';

/**
 * S20 궁합 관찰 — 두 지구인의 신호를 관찰하고 하나의 기록으로 모으는 과정 (v1.20)
 * ?error=1 로 진입하면 관측 실패(E2) 상태를 확인할 수 있다.
 */
export default function CompatibilityLoadingPage() {
  const router = useRouter();
  const { answers, markComplete } = useSession();
  const [failed, setFailed] = useState(false);
  const resultRef = useRef<{ score: number | null; compared: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const shouldFail = new URLSearchParams(window.location.search).get('error') === '1';
        if (shouldFail) throw new Error('ERR_OBSERVE_TIMEOUT');

        const result = await calculateCompatibility({
          declared: answers.declared,
          target: answers.target,
        });
        if (!cancelled) {
          resultRef.current = { score: result.score, compared: result.comparedCount };
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [answers.declared, answers.target]);

  const handleComplete = useCallback(() => {
    const result = resultRef.current;
    markComplete('compatibility');

    // 비교할 정보가 부족하면 점수 대신 '확신 낮음'으로 간다 (E3).
    if (result && result.score === null) {
      trackEvent('compatibility_low_confidence', { compared: result.compared });
    } else {
      trackEvent('compatibility_complete', {
        score: result?.score ?? 0,
        compared: result?.compared ?? 0,
      });
    }

    router.replace(ROUTES.compatibility);
  }, [markComplete, router]);

  if (failed) {
    return (
      <ScreenLayout
        footer={
          <div className="flex flex-col gap-0.5">
            <Button onClick={() => router.replace(ROUTES.compatibilityAnalyzing)}>
              다시 시도
            </Button>
            <Button variant="text" onClick={() => router.push(ROUTES.target)}>
              나중에 하기
            </Button>
          </div>
        }
      >
        <ErrorStateView />
      </ScreenLayout>
    );
  }

  return (
    <LovyObservation
      pose="observe"
      size={78}
      stages={COMPATIBILITY_OBSERVATION}
      /* 관찰 필드의 토큰 = 실제로 비교하는 4개 관계 축. 화면에 없는 신호를 그리지 않는다. */
      tokens={AXIS_DEFINITIONS.map((axis) => axis.label)}
      caveat={OBSERVATION_CAVEAT.compatibility}
      onComplete={handleComplete}
      footerNote="입력된 정보 기준으로만 비교 중"
    />
  );
}
