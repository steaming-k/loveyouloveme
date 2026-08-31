'use client';

import { useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

import { LOADING_LINE_MS, type LoadingLine } from '@/data/copy';
import type { LovyPose } from '@/data/lovy';
import { cn } from '@/lib/cn';
import { Lovy } from './Lovy';

interface LovyLoadingProps {
  pose: LovyPose;
  size: number;
  lines: readonly LoadingLine[];
  /** 모든 줄이 지나간 뒤 호출 */
  onComplete: () => void;
  footerNote: string;
  /** 진행 표시 방식 — 관찰(bar) / 비교(두 신호 정렬) */
  indicator: 'bar' | 'align';
}

const TONE_CLASS: Record<LoadingLine['tone'], string> = {
  whisper: 'text-meta text-ink-faint',
  main: 'text-lead font-medium text-ink',
  doubt: 'text-caption text-ink-sub',
};

/**
 * AI 분석 로딩 (S08 / S20)
 * 일반 스피너 하나로 끝내지 않고, 러비의 관측 로그가 순서대로 쌓인다.
 * prefers-reduced-motion 이면 애니메이션 없이 전체 로그를 한 번에 보여준다.
 */
export function LovyLoading({
  pose,
  size,
  lines,
  onComplete,
  footerNote,
  indicator,
}: LovyLoadingProps) {
  const reduceMotion = useReducedMotion();
  // SSR 결과와 첫 클라이언트 렌더가 같아야 하므로 초기값은 항상 1로 둔다.
  const [visibleCount, setVisibleCount] = useState(1);

  useEffect(() => {
    if (reduceMotion) {
      setVisibleCount(lines.length);
      const timer = setTimeout(onComplete, 1200);
      return () => clearTimeout(timer);
    }

    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let index = 1; index < lines.length; index += 1) {
      timers.push(
        setTimeout(() => setVisibleCount(index + 1), LOADING_LINE_MS * index),
      );
    }
    timers.push(setTimeout(onComplete, LOADING_LINE_MS * lines.length + 500));

    return () => timers.forEach(clearTimeout);
  }, [lines.length, onComplete, reduceMotion]);

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex flex-1 flex-col items-center justify-center px-8 pb-10"
        role="status"
        aria-live="polite"
      >
        <Lovy pose={pose} size={size} float="fast" decorative />

        {indicator === 'bar' ? (
          <div className="my-[22px] h-[3px] w-[170px] overflow-hidden rounded-sm bg-track">
            <div className="h-[3px] w-[30%] animate-lovy-bar rounded-sm bg-brand" />
          </div>
        ) : (
          <div className="my-[18px] flex items-center gap-2.5">
            <span className="h-1.5 w-11 rounded-sm bg-brand" />
            <span className="h-1.5 w-1.5 animate-lovy-pulse rounded-full bg-brand-soft" />
            <span className="h-1.5 w-11 rounded-sm bg-brand-soft" />
          </div>
        )}

        <ul className="flex flex-col items-center gap-2.5 text-center">
          {lines.slice(0, visibleCount).map((line) => (
            <li key={line.text} className={cn('reveal-up keep-all', TONE_CLASS[line.tone])}>
              {line.text}
            </li>
          ))}
        </ul>
      </div>

      <p className="flex-none px-gutter pb-[30px] text-center text-meta text-ink-faint">
        {footerNote}
      </p>
    </div>
  );
}
