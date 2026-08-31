'use client';

import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * prefers-reduced-motion 을 한 곳에서 처리한다.
 *
 * 컴포넌트마다 useReducedMotion()으로 initial prop을 갈아끼우면
 * 서버 렌더링 결과와 클라이언트 렌더링 결과가 달라져 hydration이 깨진다.
 * MotionConfig에 맡기면 사용자 설정에 따라 transform 애니메이션만 자동으로 꺼진다.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.32, ease: [0.22, 0.61, 0.36, 1] }}>
      {children}
    </MotionConfig>
  );
}
