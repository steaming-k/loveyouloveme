'use client';

import { useEffect, useState } from 'react';

import {
  OBSERVATION_PENDING,
  OBSERVATION_READY,
  type ObservationStage,
} from '@/data/copy';
import type { LovyPose } from '@/data/lovy';
import { cn } from '@/lib/cn';
import { OBSERVATION, prefersReducedMotion } from '@/lib/motion';
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
  /**
   * 연출이 끝났는데 **실제 처리가 아직 안 끝난** 상태인가 (v1.38).
   *
   * 사진 분석(S08)은 Provider 응답을 기다린다. 시퀀스가 짧아진 만큼 '연출은 끝났지만
   * 결과는 아직'인 구간이 눈에 띄게 되는데, 그때 `관찰 보고서가 완성됐어.`를 띄우면
   * **완성되지 않은 것을 완성됐다고 말하는 것**이다(§1.5-4). 이 값이 true면 그 자리에
   * 아직 보는 중이라고 말한다. 궁합(S20)은 순수 계산이라 넘기지 않는다.
   */
  pending?: boolean;
  /** 재관찰 — 이미 본 연출을 같은 길이로 두 번 강요하지 않는다 */
  revisit?: boolean;
}

/**
 * 분석 화면 = 러비의 관찰 과정 (S08 / S20 · v1.20 → v1.38)
 *
 * ⚠️ **연출 때문에 분석을 늦추지 않는다.** 총 길이는 `observationTotalMs()`(motion.ts)가
 * 한 곳에서 정한다 — v1.37까지 `1400 × 4 + 500 = 6.1초`였고, 궁합은 순수 계산이라 그
 * 6.1초가 **그대로 사용자 대기**였다(실측 median 6158ms).
 *
 * **v1.38 — 교체(replace)에서 누적(stack)으로 바꿨다.**
 * 예전에는 한 단계가 다음 단계로 **교체**돼서, 한 줄을 다 읽기 전에 사라지면 정보를
 * 놓쳤다. 그래서 v1.22가 단계 간격을 1100 → 1400ms로 올려야 했다 — 간격이 '읽는 시간'을
 * 책임지고 있었던 것이다. 지금은 줄이 **쌓인다.** 앞 줄이 사라지지 않으니 사용자가 자기
 * 속도로 읽으면 되고, 간격은 '무슨 일이 순서대로 일어난다'만 전달하면 된다.
 * 4단계 = OBSERVE → COLLECT → CONNECT → REPORT 의미는 그대로 남고 대기만 줄었다.
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
  pending = false,
  revisit = false,
}: LovyObservationProps) {
  const [stage, setStage] = useState(0);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShowAll(true);
      setStage(stages.length);
      const timer = setTimeout(onComplete, OBSERVATION.reducedMs);
      return () => clearTimeout(timer);
    }

    const scale = revisit ? OBSERVATION.revisitScale : 1;
    const step = OBSERVATION.stageMs * scale;

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let index = 1; index <= stages.length; index += 1) {
      timers.push(setTimeout(() => setStage(index), step * index));
    }
    timers.push(setTimeout(onComplete, step * stages.length + OBSERVATION.tailMs * scale));

    return () => timers.forEach(clearTimeout);
  }, [stages.length, onComplete, revisit]);

  const ready = stage >= stages.length;
  /** 단계 배열이 비어 있을 수 없지만, noUncheckedIndexedAccess를 위해 안전하게 좁힌다. */
  const current = stages[Math.min(stage, stages.length - 1)] ?? stages[0];
  const stepLabel =
    ready || !current
      ? pending
        ? 'OBSERVING'
        : 'REPORT READY'
      : `${String(stage + 1).padStart(2, '0')} / ${String(stages.length).padStart(2, '0')} · ${current.code}`;
  /**
   * 누적 표시 — 지금까지 지나온 단계를 전부 남긴다. 마지막 줄만 강조하고 앞 줄은
   * 낮춰서, 읽는 순서를 잃지 않으면서도 현재 위치가 어디인지 알 수 있게 한다.
   */
  const revealed = stages.slice(0, Math.max(1, Math.min(stage + 1, stages.length)));

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
          {/*
            v1.38 — 단계를 **쌓는다.** 예전에는 한 줄이 다음 줄로 교체돼서 다 읽기 전에
            사라지면 정보를 놓쳤고, 그래서 단계 간격이 '읽는 시간'만큼 길어야 했다.
            지금은 지나온 줄이 남으므로 사용자가 자기 속도로 읽는다 — 앞 줄은 낮추고
            마지막 줄만 강조해서 지금 어디인지도 함께 말한다.
            reduced-motion(`showAll`)은 처음부터 4줄 전부를 같은 목록으로 보여준다.
          */}
          <ol className="flex flex-col gap-1 text-center">
            {(showAll ? stages : revealed).map((item, index, list) => {
              const last = index === list.length - 1;
              return (
                <li
                  key={item.code}
                  className={cn(
                    'keep-all',
                    /*
                      reduced-motion에서는 4줄이 유일한 표시이므로 **낮추지 않는다.**
                      지나온 줄을 낮추는 건 '지금 어디인지'를 모션 없이 알려주기 위한
                      것인데, 목록으로 한 번에 보여줄 때는 낮출 '지나온 줄'이 없다.
                    */
                    showAll
                      ? 'text-sub text-ink'
                      : last
                        ? 'reveal-up text-lead font-medium text-ink'
                        : 'text-sub text-ink-muted',
                  )}
                >
                  <span className="mr-1.5 text-[10px] font-semibold tracking-[0.14em] text-ink-faint">
                    {item.code}
                  </span>
                  {item.text}
                </li>
              );
            })}
          </ol>

          {/*
            연출이 끝났다고 결과가 끝난 건 아니다 — `pending`이면 '완성됐어'라고 하지 않는다.
          */}
          {ready && !showAll ? (
            <p className="reveal-up text-lead font-medium keep-all text-center text-ink">
              {pending ? OBSERVATION_PENDING : OBSERVATION_READY}
            </p>
          ) : null}

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
