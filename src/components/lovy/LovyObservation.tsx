'use client';

import { useEffect, useState } from 'react';

import {
  OBSERVATION_READY,
  OBSERVATION_STAGE_MS,
  type ObservationStage,
} from '@/data/copy';
import type { LovyPose } from '@/data/lovy';
import { cn } from '@/lib/cn';
import { prefersReducedMotion } from '@/lib/motion';
import { Lovy } from './Lovy';
import { ObservationField } from './ObservationField';

interface LovyObservationProps {
  pose: LovyPose;
  size: number;
  /** OBSERVE → COLLECT → CONNECT → REPORT 단계 */
  stages: readonly ObservationStage[];
  /** 관찰 필드에 올라가는 신호 이름 */
  tokens: readonly string[];
  /** 마지막 단계에 붙는 고백 한 줄 */
  caveat?: string;
  /** 모든 단계가 지나간 뒤 호출 */
  onComplete: () => void;
  footerNote: string;
}

/**
 * 분석 화면 = 러비의 관찰 과정 (S08 / S20 · v1.20)
 *
 * ⚠️ **연출 때문에 분석을 늦추지 않는다.** 총 시간은
 * `OBSERVATION_STAGE_MS × 단계 수 + 500ms`다(v1.22: 1400ms × 4 + 500ms). 궁합은 순수 계산이라 이 시간이
 * 그대로 최소 연출 시간이 되고, 사진 분석은 실제 응답이 늦으면 마지막 단계에서 기다린다
 * (호출부가 `onComplete`와 분석 완료를 **둘 다** 만족할 때만 이동시킨다).
 *
 * prefers-reduced-motion:
 *   단계를 애니메이션으로 넘기지 않고 4단계를 **목록으로 한 번에** 보여준다 —
 *   모션이 '무슨 일이 일어나는지'를 이해하는 유일한 수단이 되면 안 되기 때문이다.
 *   ⚠️ `useReducedMotion()`으로 렌더를 분기하면 SSR 결과와 첫 클라이언트 렌더가 달라진다.
 *   그래서 초기 렌더는 항상 단계 0이고, 아래 effect(= 클라이언트 전용)에서만 목록으로 바꾼다.
 */
export function LovyObservation({
  pose,
  size,
  stages,
  tokens,
  caveat,
  onComplete,
  footerNote,
}: LovyObservationProps) {
  const [stage, setStage] = useState(0);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShowAll(true);
      setStage(stages.length);
      const timer = setTimeout(onComplete, 1200);
      return () => clearTimeout(timer);
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let index = 1; index <= stages.length; index += 1) {
      timers.push(setTimeout(() => setStage(index), OBSERVATION_STAGE_MS * index));
    }
    timers.push(setTimeout(onComplete, OBSERVATION_STAGE_MS * stages.length + 500));

    return () => timers.forEach(clearTimeout);
  }, [stages.length, onComplete]);

  const ready = stage >= stages.length;
  /** 단계 배열이 비어 있을 수 없지만, noUncheckedIndexedAccess를 위해 안전하게 좁힌다. */
  const current = stages[Math.min(stage, stages.length - 1)] ?? stages[0];
  const stepLabel =
    ready || !current
      ? 'REPORT READY'
      : `${String(stage + 1).padStart(2, '0')} / ${String(stages.length).padStart(2, '0')} · ${current.code}`;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-gutter pb-6">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-ink-faint">
          LOVY OBSERVATION
        </p>

        <Lovy pose={pose} size={size} float="fast" decorative className="mt-2.5" />

        <ObservationField
          tokens={tokens}
          stage={showAll ? stages.length - 1 : stage}
          className="mt-3"
        />

        {/* 진행 상태는 색·모션만으로 전달하지 않는다 — 아래 stepLabel이 항상 텍스트로 말한다 */}
        <ol className="mt-5 flex gap-1.5" aria-hidden>
          {stages.map((item, index) => (
            <li
              key={item.code}
              className={cn(
                'h-[2px] w-9 rounded-sm transition-colors duration-300',
                index < stage
                  ? 'bg-brand-soft'
                  : index === stage
                    ? 'bg-brand'
                    : 'bg-track',
              )}
            />
          ))}
        </ol>

        <p className="mt-3 text-[10px] font-semibold tracking-[0.16em] text-ink-faint tnum">
          {stepLabel}
        </p>

        <div className="mt-1.5 flex flex-col items-center gap-1.5" role="status" aria-live="polite">
          {showAll ? (
            <ol className="flex flex-col gap-1.5 text-center">
              {stages.map((item) => (
                <li key={item.code} className="text-sub keep-all text-ink">
                  <span className="mr-1.5 text-[10px] font-semibold tracking-[0.14em] text-ink-faint">
                    {item.code}
                  </span>
                  {item.text}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-lead font-medium keep-all text-center text-ink">
              {ready || !current ? OBSERVATION_READY : current.text}
            </p>
          )}

          {caveat && (ready || showAll || stage >= stages.length - 1) ? (
            <p className="reveal-up text-meta keep-all text-center text-ink-faint">{caveat}</p>
          ) : null}
        </div>
      </div>

      <p className="flex-none px-gutter pb-[30px] text-center text-meta text-ink-faint">
        {footerNote}
      </p>
    </div>
  );
}
