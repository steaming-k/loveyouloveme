'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/common/Button';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { ErrorStateView } from '@/components/common/StateScreens';
import { LovyLoading } from '@/components/lovy/LovyLoading';
import { OBSERVED_LOADING } from '@/data/copy';
import { ROUTES } from '@/lib/routes';
import { analyzeObservedProfile } from '@/services/aiService';
import { useSession } from '@/state/SessionProvider';

/**
 * S08 Observed Me 로딩
 * 러비의 관측 로그가 순서대로 쌓이고, 로그가 끝나면 결과로 넘어간다.
 *
 * ?error=1 로 진입하면 관측 실패(E2) 상태를 그대로 확인할 수 있다.
 * 쿼리는 마운트 후에 읽는다 — useSearchParams()를 쓰면 정적 프리렌더 결과와
 * 첫 클라이언트 렌더가 달라져 hydration이 깨진다.
 */
export default function ObservedLoadingPage() {
  const router = useRouter();
  const { answers } = useSession();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const shouldFail = new URLSearchParams(window.location.search).get('error') === '1';
        if (shouldFail) throw new Error('ERR_OBSERVE_TIMEOUT');
        await analyzeObservedProfile(answers.photos);
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [answers.photos]);

  // 실패하면 LovyLoading이 언마운트되므로 이 콜백은 정상 경로에서만 실행된다.
  const handleSequenceComplete = useCallback(() => {
    router.replace(ROUTES.observed);
  }, [router]);

  if (failed) {
    return (
      <ScreenLayout
        footer={
          <div className="flex flex-col gap-0.5">
            <Button onClick={() => router.replace(ROUTES.photoAnalyzing)}>다시 시도</Button>
            <Button variant="text" onClick={() => router.push(ROUTES.photos)}>
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
