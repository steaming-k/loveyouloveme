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
import { clearScrollPosition } from '@/lib/scrollRestore';
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

  const funnelAnalysisId = answers.currentAnalysisMeta?.funnelAnalysisId ?? null;

  /**
   * 재관찰인가 (v1.38 · §16).
   *
   * 첫 관찰은 러비가 무엇을 하는지 처음 설명하는 자리지만, 두 번째부터는 이미 아는
   * 연출이다. 같은 세계관을 같은 길이로 두 번 보여주지 않는다.
   *
   * 판정에 새 상태를 만들지 않는다 — `completed.compatibility`는 이미 결과를 본 적이
   * 있는지를 뜻하고, '새로운 사람과 궁합 보기'는 v1.35에서 이 값을 초기화한다. 즉
   * **새 상대는 자동으로 false(전체 연출), 같은 상대 재분석만 true**가 된다.
   */
  const revisit = answers.completed.compatibility;

  /**
   * v1.22 §12 — **새 분석은 맨 위에서 시작한다.**
   *
   * 결과 화면의 스크롤 복원 키는 `funnelAnalysisId`다. 새 상대는 id 자체가 새로 발급되지만,
   * 같은 상대의 정보를 고쳐서 다시 관찰하면 id가 그대로다. 그때 이전 위치로 복원되면
   * '새로 분석했는데 중간부터 보이는' 상태가 되므로, 관찰 화면에 들어온 시점에 지운다.
   */
  useEffect(() => {
    if (!funnelAnalysisId) return;
    clearScrollPosition(`compat:${funnelAnalysisId}`);
  }, [funnelAnalysisId]);

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
          setResult({ score: result.score, compared: result.comparedCount });
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

  /**
   * 연출이 끝났다는 신호. **이동 조건이 아니다** — 아래 effect가 연출 완료와 계산 완료를
   * 둘 다 만족할 때만 이동시킨다(S08과 같은 패턴).
   *
   * ⚠️ v1.38 — 예전에는 `onComplete`에서 곧바로 `resultRef.current`를 읽고 이동했다.
   * 6.1초 동안 240ms짜리 계산이 못 끝날 일은 없어서 문제가 드러나지 않았을 뿐, 계산이
   * 늦으면 `score: 0 · compared: 0`을 **실제 결과인 것처럼** Analytics로 보내고 빈 결과
   * 화면으로 넘어가는 구조였다. 연출을 2.5초로 줄이면서 그 여유가 사라지므로, 없는 값을
   * 0으로 채우는 대신 있는 값을 기다린다.
   */
  const [sequenceDone, setSequenceDone] = useState(false);
  const [result, setResult] = useState<{ score: number | null; compared: number } | null>(null);
  const navigatedRef = useRef(false);

  const handleComplete = useCallback(() => setSequenceDone(true), []);

  useEffect(() => {
    if (!sequenceDone || !result || navigatedRef.current) return;
    navigatedRef.current = true;

    markComplete('compatibility');

    // 비교할 정보가 부족하면 점수 대신 '확신 낮음'으로 간다 (E3).
    if (result.score === null) {
      trackEvent('compatibility_low_confidence', { compared: result.compared });
    } else {
      trackEvent('compatibility_complete', { score: result.score, compared: result.compared });
    }

    router.replace(ROUTES.compatibility);
  }, [sequenceDone, result, markComplete, router]);

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
      /* 궁합은 순수 계산이라 `pending`을 넘기지 않는다 — 연출보다 늦게 끝나지 않는다 */
      revisit={revisit}
      footerNote="입력된 정보 기준으로만 비교 중"
    />
  );
}
