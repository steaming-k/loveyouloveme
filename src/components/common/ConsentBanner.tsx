'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

import { useAnalyticsConsent } from '@/hooks/useAnalyticsConsent';
import { Button } from './Button';

/**
 * Analytics Consent Gate (v1.12 §14~§16)
 *
 * GA4가 실제로 연결되면서 필요해진 최소한의 동의 안내다. 실제 법률 자문을 거친 배너처럼
 * 쓰지 않는다 — 제품 UX 차원의 안내일 뿐이다.
 *
 * ⚠️ 어느 쪽을 눌러도 제품 사용을 막지 않는다(§15) — 배너는 그냥 사라질 뿐이다.
 * `analyticsConsent === 'unknown'`일 때만 보인다. 나중에 `/privacy`에서 다시 바꿀 수 있다.
 *
 * ⚠️ SSR에서는 절대 렌더하지 않는다 — `useSyncExternalStore`의 서버 스냅샷도 'unknown'이라
 * 조건 자체는 서버·클라이언트가 같지만, framer-motion이 `motion.div`의 inline style을
 * 서버(문자열)와 클라이언트(런타임 계산값)에서 다르게 그려 hydration mismatch를 낸다.
 * `mounted` 가드로 클라이언트 마운트 이후에만 그려서 이 문제를 피한다.
 */
export function ConsentBanner() {
  const [consent, setConsent] = useAnalyticsConsent();
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <AnimatePresence>
      {mounted && consent === 'unknown' ? (
        <motion.div
          role="dialog"
          aria-label="분석 데이터 사용 동의"
          className="absolute inset-x-0 bottom-0 z-30 flex flex-col gap-2.5 rounded-t-[18px] border border-line bg-surface px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-4 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]"
          initial={{ y: reduceMotion ? 0 : 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: reduceMotion ? 0 : 40, opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.22 }}
        >
          <p className="text-[13.5px] font-semibold">분석 데이터 사용 안내</p>
          <p className="text-[12px] keep-all leading-relaxed text-ink-sub">
            서비스 개선을 위해 어떤 화면을 봤는지 같은 사용 통계를 모을 수 있어. 사진·관계
            답변 같은 내용은 여기 포함되지 않아. 언제든 나중에{' '}
            <span className="font-medium text-ink">Privacy</span> 화면에서 바꿀 수 있어.
          </p>
          <div className="flex gap-2 pt-0.5">
            <Button
              variant="secondary"
              className="h-[42px] flex-1 text-[13px]"
              onClick={() => setConsent('denied')}
            >
              필수 기능만 사용
            </Button>
            <Button className="h-[42px] flex-1 text-[13px]" onClick={() => setConsent('granted')}>
              동의
            </Button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
