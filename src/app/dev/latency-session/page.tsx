'use client';

import { notFound } from 'next/navigation';
import { useState } from 'react';

import { useSession } from '@/state/SessionProvider';

/**
 * /dev/latency-session — **개발 전용** 샘플 세션 불러오기 (Deep Report latency 측정 준비)
 *
 * 기존 '샘플 세션' 버튼은 불러온 뒤 결과 화면으로 이동해 다른 AI Task를 부른다. 이 페이지는 세션만 채우고
 * 이동하지 않는다 — latency 측정에서 Deep Report 외 AI 호출이 섞이지 않게 한다.
 * ⚠️ AI · 네트워크 호출 없음. ⚠️ Production에서는 404.
 */
export default function LatencySessionPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Loader />;
}

function Loader() {
  const { loadSampleSession, hydrated } = useSession();
  const [loaded, setLoaded] = useState(false);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-3 bg-canvas px-4 py-6">
      <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted">DEV · LATENCY SESSION</p>
      <button
        type="button"
        disabled={!hydrated}
        onClick={() => {
          loadSampleSession();
          setLoaded(true);
        }}
        className="min-h-11 rounded-row border border-line bg-surface px-4 text-left text-sub"
      >
        샘플 세션 불러오기(이동 없음)
      </button>
      <p data-testid="latency-session-state" className="text-caption text-ink-sub">
        {loaded ? 'loaded' : hydrated ? 'ready' : 'hydrating'}
      </p>
    </main>
  );
}
